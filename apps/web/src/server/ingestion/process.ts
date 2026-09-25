import type { Database } from "bun:sqlite";
import { z } from "zod";
import { ingestRequest, properties, parseJson } from "@quacklytics/contracts";
import { setting, setSetting } from "../db/database";
export class RequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
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

export function hash(value: string) {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}
export function processIngestion(db: Database, input: unknown) {
  const request = ingestRequest.parse(input);
  const fingerprint = hash(
    JSON.stringify(request.events) +
      (request.deferExport ? "\ndeferExport" : ""),
  );
  return db.transaction(() => {
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
        throw new RequestError(409, "Request ID reused with different events");
      return z
        .object({
          committed: z.number(),
          duplicates: z.number(),
          revision: z.number(),
        })
        .parse(parseJson(previous.result));
    }
    let committed = 0,
      duplicates = 0;
    const dirty = new Set<string>();
    // Transaction-local state cannot leak across requests, projects or rollbacks.
    const persons = new Map<string, PendingPerson>();
    const schemas = new Map<string, Map<string, PendingSchema>>();
    for (const event of [...request.events].sort(
      (a, b) =>
        Date.parse(a.timestamp) - Date.parse(b.timestamp) ||
        a.id.localeCompare(b.id),
    )) {
      const eventHash = hash(JSON.stringify(event));
      const existing = stringRow
        .nullable()
        .parse(
          db.query("SELECT fingerprint FROM events WHERE id=?").get(event.id),
        );
      if (existing) {
        if (existing.fingerprint !== eventHash)
          throw new RequestError(409, "Event ID reused with different content");
        duplicates++;
        continue;
      }
      const time = Date.parse(event.timestamp);
      let person = event.personId ?? null;
      if (event.sessionId) {
        const session = sessionRow
          .nullable()
          .parse(
            db
              .query(
                "SELECT person_id,first_seen,last_seen FROM sessions WHERE id=?",
              )
              .get(event.sessionId),
          );
        if (session?.person_id && person && session.person_id !== person)
          throw new RequestError(
            409,
            "Session already belongs to another person",
          );
        person = person ?? session?.person_id ?? null;
        db.query(
          "INSERT INTO sessions VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET person_id=excluded.person_id,first_seen=min(first_seen,excluded.first_seen),last_seen=max(last_seen,excluded.last_seen)",
        ).run(event.sessionId, person, time, time);
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
                .all(event.sessionId),
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
        "INSERT INTO events(id,timestamp,event_type,session_id,person_id,properties,person_properties,fingerprint) VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        event.id,
        time,
        event.eventType,
        event.sessionId ?? null,
        event.personId ?? null,
        JSON.stringify(event.properties),
        JSON.stringify(event.personProperties),
        eventHash,
      );
      for (const [name, value] of Object.entries(event.properties)) {
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
      dirty.add(new Date(time).toISOString().slice(0, 7));
      // Record event types even if their properties are empty.
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
    const result = { committed, duplicates, revision };
    db.query("INSERT INTO requests VALUES(?,?,?)").run(
      request.requestId,
      fingerprint,
      JSON.stringify(result),
    );
    return result;
  })();
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
