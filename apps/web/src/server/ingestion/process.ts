import type { Database } from "bun:sqlite";
import { z } from "zod";
import {
  ingestRequest,
  sdkRequest,
  properties,
  parseJson,
} from "@quacklytics/contracts";
import { setting, setSetting } from "../db/database";
import { RequestError } from "../errors";
import type { AnonymousVisitors } from "./anonymous";
const stringRow = z.object({ fingerprint: z.string() });
const sessionRow = z.object({
  person_id: z.string().nullable(),
  first_seen: z.number(),
  last_seen: z.number(),
});
const personRow = z.object({
  first_seen: z.number(),
  properties: z.string(),
  property_timestamps: z.string(),
});
const personStamp = z.object({ time: z.number(), eventId: z.string() });
type PendingPerson = {
  firstSeen: number;
  properties: z.infer<typeof properties>;
  stamps: Record<string, z.infer<typeof personStamp>>;
};
type PendingSchema = { type: string; values: Set<string> };
const ANONYMOUS_SESSION_GAP_MS = 30 * 60 * 1000;
const nearbySession = z.object({ session_id: z.string() }).nullable();

/** Continues a declined visitor's session within 30 minutes, including across the midnight salt rotation. */
function anonymousSession(
  db: Database,
  visitors: AnonymousVisitors,
  time: number,
) {
  for (const visitor of [visitors.current, visitors.previous]) {
    if (!visitor) continue;
    const nearby = nearbySession.parse(
      db
        .query(
          "SELECT session_id FROM events WHERE anonymous_id=? AND session_id IS NOT NULL AND timestamp BETWEEN ? AND ? ORDER BY abs(timestamp-?) LIMIT 1",
        )
        .get(
          visitor,
          time - ANONYMOUS_SESSION_GAP_MS,
          time + ANONYMOUS_SESSION_GAP_MS,
          time,
        ),
    );
    if (nearby) return { anonymousId: visitor, sessionId: nearby.session_id };
  }
  return { anonymousId: visitors.current, sessionId: crypto.randomUUID() };
}

export function hash(value: string) {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}
// Archived months accept events only through the backfill endpoint, which merges
// them into the stored month; ordinary ingestion drops them individually so the
// rest of the batch still commits. SDK events from browsers gain the visitor's
// `$country` unless they set it; server-side HTTP clients would report their own.
export function processIngestion(
  db: Database,
  input: unknown,
  {
    backfill = false,
    visitors,
    country,
  }: {
    backfill?: boolean;
    visitors?: () => AnonymousVisitors;
    country?: string | undefined;
  } = {},
) {
  const versioned = z.object({ protocolVersion: z.unknown() }).safeParse(input)
    .success
    ? sdkRequest.parse(input)
    : undefined;
  const request = versioned
    ? {
        requestId: versioned.requestId,
        deferExport: false,
        events: versioned.operations.flatMap((operation) =>
          operation.kind === "event"
            ? [
                {
                  id: operation.id,
                  timestamp: operation.timestamp,
                  eventType: operation.eventType,
                  sessionId: operation.sessionId,
                  personId: undefined,
                  anonymousId: operation.anonymousId,
                  userId: operation.userId,
                  anonymous: operation.anonymous,
                  properties: {
                    ...operation.properties,
                    $context: operation.context,
                  },
                  personProperties: {},
                },
              ]
            : [],
        ),
      }
    : ingestRequest.parse(input);
  const controls =
    versioned?.operations.filter(
      (operation) => operation.kind === "identify",
    ) ?? [];
  const claims =
    versioned?.operations.filter((operation) => operation.kind === "claim") ??
    [];
  const fingerprint = hash(
    JSON.stringify(versioned?.operations ?? request.events) +
      (request.deferExport ? "\ndeferExport" : "") +
      (backfill ? "\nbackfill" : ""),
  );
  const historyBoundary = Date.parse(new Date().toISOString().slice(0, 10));
  return db
    .transaction(() => {
      const previous = z
        .object({ fingerprint: z.string(), result: z.string() })
        .nullable()
        .parse(
          db
            .query("SELECT fingerprint,result FROM requests WHERE id=?")
            .get(request.requestId),
        );
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new RequestError(
            409,
            "Request ID reused with different events",
          );
        return z
          .object({
            committed: z.number(),
            duplicates: z.number(),
            rejected: z.number().default(0),
            revision: z.number(),
          })
          .parse(parseJson(previous.result));
      }
      let committed = 0,
        duplicates = 0,
        rejected = 0;
      const dirty = new Set<string>();
      // Transaction-local state cannot leak across requests, projects or rollbacks.
      const persons = new Map<string, PendingPerson>();
      let resolvedVisitors: AnonymousVisitors | undefined;
      const schemas = new Map<string, Map<string, PendingSchema>>();
      for (const operation of controls) {
        const fingerprint = hash(JSON.stringify(operation));
        const existing = stringRow
          .nullable()
          .parse(
            db
              .query("SELECT fingerprint FROM identity_operations WHERE id=?")
              .get(operation.id),
          );
        if (existing) {
          if (existing.fingerprint !== fingerprint)
            throw new RequestError(
              409,
              "Operation ID reused with different content",
            );
          duplicates++;
          continue;
        }
        const link = z
          .object({ user_id: z.string() })
          .nullable()
          .parse(
            db
              .query("SELECT user_id FROM identity_links WHERE anonymous_id=?")
              .get(operation.anonymousId),
          );
        if (link && link.user_id !== operation.userId)
          throw new RequestError(
            409,
            "Anonymous identity already belongs to another user; reset before switching accounts",
          );
        db.query(
          "INSERT INTO identity_links VALUES(?,?) ON CONFLICT(anonymous_id) DO NOTHING",
        ).run(operation.anonymousId, operation.userId);
        if (!link) {
          // Only a new link changes historical actors. Aggregate in SQLite rather
          // than materializing every historical event on repeated identify calls.
          for (const row of z
            .array(z.object({ timestamp: z.number() }))
            .parse(
              db
                .query(
                  "SELECT min(timestamp) timestamp FROM events WHERE anonymous_id=? GROUP BY strftime('%Y-%m',timestamp/1000,'unixepoch')",
                )
                .all(operation.anonymousId),
            )) {
            if (row.timestamp < historyBoundary)
              dirty.add(new Date(row.timestamp).toISOString().slice(0, 7));
            mergePerson(
              db,
              persons,
              `user:${operation.userId}`,
              row.timestamp,
              operation.id,
              {},
            );
          }
        }
        mergePerson(
          db,
          persons,
          `user:${operation.userId}`,
          Date.parse(operation.timestamp),
          operation.id,
          operation.traits,
        );
        db.query("INSERT INTO identity_operations VALUES(?,?)").run(
          operation.id,
          fingerprint,
        );
        committed++;
      }
      for (const event of [...request.events].sort(
        (a, b) =>
          Date.parse(a.timestamp) - Date.parse(b.timestamp) ||
          a.id.localeCompare(b.id),
      )) {
        if (
          !backfill &&
          db
            .query("SELECT 1 FROM archived_partitions WHERE partition=?")
            .get(new Date(event.timestamp).toISOString().slice(0, 7))
        ) {
          rejected++;
          continue;
        }
        const eventHash = hash(JSON.stringify(event));
        const existing = stringRow
          .nullable()
          .parse(
            db.query("SELECT fingerprint FROM events WHERE id=?").get(event.id),
          );
        if (existing) {
          if (existing.fingerprint !== eventHash)
            throw new RequestError(
              409,
              "Event ID reused with different content",
            );
          duplicates++;
          continue;
        }
        // Added after the duplicate check, so a retry from elsewhere stays a duplicate.
        const eventProperties =
          versioned && country && !("$country" in event.properties)
            ? { ...event.properties, $country: country }
            : event.properties;
        const time = Date.parse(event.timestamp);
        let anonymousId =
          "anonymousId" in event ? event.anonymousId : undefined;
        let sessionId = event.sessionId;
        // Resolved after the duplicate check: the fingerprint covers the event as sent.
        if ("anonymous" in event && event.anonymous) {
          if (!visitors)
            throw new RequestError(400, "Anonymous events require a client");
          resolvedVisitors ??= visitors();
          ({ anonymousId, sessionId } = anonymousSession(
            db,
            resolvedVisitors,
            time,
          ));
        }
        const userId = "userId" in event ? event.userId : undefined;
        const link = anonymousId
          ? z
              .object({ user_id: z.string() })
              .nullable()
              .parse(
                db
                  .query(
                    "SELECT user_id FROM identity_links WHERE anonymous_id=?",
                  )
                  .get(anonymousId),
              )
          : null;
        if (anonymousId && userId && link?.user_id !== userId)
          throw new RequestError(
            409,
            "Identify must commit before authenticated events",
          );
        const resolvedUser = userId ?? link?.user_id;
        if (resolvedUser)
          mergePerson(db, persons, `user:${resolvedUser}`, time, event.id, {});
        let person = event.personId ?? null;
        if (sessionId) {
          const session = sessionRow
            .nullable()
            .parse(
              db
                .query(
                  "SELECT person_id,first_seen,last_seen FROM sessions WHERE id=?",
                )
                .get(sessionId),
            );
          if (session?.person_id && person && session.person_id !== person)
            throw new RequestError(
              409,
              "Session already belongs to another person",
            );
          person = person ?? session?.person_id ?? null;
          db.query(
            "INSERT INTO sessions VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET person_id=excluded.person_id,first_seen=min(first_seen,excluded.first_seen),last_seen=max(last_seen,excluded.last_seen)",
          ).run(sessionId, person, time, time);
          if (person && !session?.person_id) {
            const historical = z
              .array(
                z.object({
                  id: z.string(),
                  timestamp: z.number(),
                  person_properties: z.string(),
                }),
              )
              .parse(
                db
                  .query(
                    "SELECT id,timestamp,person_properties FROM events WHERE session_id=? ORDER BY timestamp,id",
                  )
                  .all(sessionId),
              );
            for (const row of historical) {
              mergePerson(
                db,
                persons,
                person,
                row.timestamp,
                row.id,
                properties.parse(parseJson(row.person_properties)),
              );
              if (row.timestamp < historyBoundary)
                dirty.add(new Date(row.timestamp).toISOString().slice(0, 7));
            }
          }
        }
        if (person)
          mergePerson(
            db,
            persons,
            person,
            time,
            event.id,
            event.personProperties,
          );
        db.query(
          "INSERT INTO events(id,timestamp,event_type,session_id,person_id,properties,person_properties,fingerprint,anonymous_id,user_id) VALUES(?,?,?,?,?,?,?,?,?,?)",
        ).run(
          event.id,
          time,
          event.eventType,
          sessionId ?? null,
          event.personId ?? null,
          JSON.stringify(eventProperties),
          JSON.stringify(event.personProperties),
          eventHash,
          anonymousId ?? null,
          userId ?? null,
        );
        for (const [name, value] of Object.entries(eventProperties)) {
          const type =
            value !== null &&
            ["string", "number", "boolean"].includes(typeof value)
              ? typeof value
              : "json";
          let fields = schemas.get(event.eventType);
          if (!fields) {
            fields = new Map();
            schemas.set(event.eventType, fields);
          }
          let field = fields.get(name);
          if (!field) {
            field = { type, values: new Set() };
            fields.set(name, field);
          }
          if (field.type !== type) field.type = "json";
          // Only the first 100 distinct samples can affect the persisted cap.
          if (field.values.size < 100)
            field.values.add(
              typeof value === "string" ? value : JSON.stringify(value),
            );
        }
        if (time < historyBoundary)
          dirty.add(new Date(time).toISOString().slice(0, 7));
        // Record event types even if their properties are empty.
        committed++;
      }
      // After events, so a claim also reaches events sent in the same request.
      for (const claim of claims) {
        const fingerprint = hash(JSON.stringify(claim));
        const existing = stringRow
          .nullable()
          .parse(
            db
              .query("SELECT fingerprint FROM identity_operations WHERE id=?")
              .get(claim.id),
          );
        if (existing) {
          if (existing.fingerprint !== fingerprint)
            throw new RequestError(
              409,
              "Operation ID reused with different content",
            );
          duplicates++;
          continue;
        }
        let first = Infinity,
          last = -Infinity;
        for (const eventId of claim.eventIds) {
          // Only events sent before a decision still belong to a daily visitor,
          // so identified or already claimed events never move.
          const row = z
            .object({ timestamp: z.number() })
            .nullable()
            .parse(
              db
                .query(
                  "UPDATE events SET anonymous_id=?,session_id=? WHERE id=? AND anonymous_id LIKE 'daily:%' RETURNING timestamp",
                )
                .get(claim.anonymousId, claim.sessionId, eventId),
            );
          if (!row) continue;
          first = Math.min(first, row.timestamp);
          last = Math.max(last, row.timestamp);
          if (row.timestamp < historyBoundary)
            dirty.add(new Date(row.timestamp).toISOString().slice(0, 7));
        }
        if (first <= last) {
          db.query(
            "INSERT INTO sessions VALUES(?,NULL,?,?) ON CONFLICT(id) DO UPDATE SET first_seen=min(first_seen,excluded.first_seen),last_seen=max(last_seen,excluded.last_seen)",
          ).run(claim.sessionId, first, last);
          const link = z
            .object({ user_id: z.string() })
            .nullable()
            .parse(
              db
                .query(
                  "SELECT user_id FROM identity_links WHERE anonymous_id=?",
                )
                .get(claim.anonymousId),
            );
          if (link)
            mergePerson(
              db,
              persons,
              `user:${link.user_id}`,
              first,
              claim.id,
              {},
            );
        }
        db.query("INSERT INTO identity_operations VALUES(?,?)").run(
          claim.id,
          fingerprint,
        );
        committed++;
      }
      for (const [id, person] of persons)
        db.query(
          "INSERT INTO persons VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET first_seen=excluded.first_seen,properties=excluded.properties,property_timestamps=excluded.property_timestamps",
        ).run(
          id,
          person.firstSeen,
          JSON.stringify(person.properties),
          JSON.stringify(person.stamps),
        );
      for (const [eventType, fields] of schemas) {
        for (const [name, field] of fields) {
          const { id } = z
            .object({ id: z.number() })
            .parse(
              db
                .query(
                  "INSERT INTO schemas(event_type,name,type) VALUES(?,?,?) ON CONFLICT(event_type,name) DO UPDATE SET type=CASE WHEN type=excluded.type THEN type ELSE 'json' END RETURNING id",
                )
                .get(eventType, name, field.type),
            );
          const values = new Set(
            z
              .array(z.object({ value: z.string() }))
              .parse(
                db
                  .query("SELECT value FROM schema_values WHERE property_id=?")
                  .all(id),
              )
              .map((row) => row.value),
          );
          for (const value of field.values) {
            if (values.size >= 100) break;
            if (values.has(value)) continue;
            db.query("INSERT INTO schema_values VALUES(?,?)").run(id, value);
            values.add(value);
          }
        }
      }
      const revision = Number(setting(db, "revision")) + (committed ? 1 : 0);
      if (committed) {
        setSetting(db, "revision", String(revision));
        // Persist the deadline with the events, so a restart or interrupted importer
        // cannot leave exports paused indefinitely. Ordinary ingestion releases it.
        if (request.deferExport)
          setSetting(db, "export_deferred_until", String(Date.now() + 10000));
        else
          db.query(
            "DELETE FROM settings WHERE key='export_deferred_until'",
          ).run();
        db.query(
          "INSERT INTO jobs(id,revision) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision",
        ).run(revision);
      }
      for (const partition of dirty)
        db.query(
          "INSERT INTO dirty_partitions VALUES(?,?) ON CONFLICT(partition) DO UPDATE SET revision=excluded.revision",
        ).run(partition, revision);
      const result = { committed, duplicates, rejected, revision };
      db.query("INSERT INTO requests VALUES(?,?,?)").run(
        request.requestId,
        fingerprint,
        JSON.stringify(result),
      );
      return result;
    })
    .immediate();
}
function mergePerson(
  db: Database,
  persons: Map<string, PendingPerson>,
  id: string,
  time: number,
  eventId: string,
  updates: z.infer<typeof properties>,
) {
  let person = persons.get(id);
  if (!person) {
    const row = personRow
      .nullable()
      .parse(
        db
          .query(
            "SELECT first_seen,properties,property_timestamps FROM persons WHERE id=?",
          )
          .get(id),
      );
    person = {
      firstSeen: row?.first_seen ?? time,
      properties: row ? properties.parse(parseJson(row.properties)) : {},
      stamps: row
        ? z
            .record(z.string(), personStamp)
            .parse(parseJson(row.property_timestamps))
        : {},
    };
    persons.set(id, person);
  }
  person.firstSeen = Math.min(person.firstSeen, time);
  for (const [key, value] of Object.entries(updates)) {
    const old = person.stamps[key];
    if (
      !old ||
      old.time < time ||
      (old.time === time && old.eventId < eventId)
    ) {
      person.properties[key] = value;
      person.stamps[key] = { time, eventId };
    }
  }
}
