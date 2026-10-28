import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { catalogFile, catalogAccess, parseJson } from "@quacklytics/contracts";
import type { Database } from "bun:sqlite";
import { setting, setSetting } from "../db/database";

import { appendEvent, createEventsTable, sqlString } from "./parquet";
import { utcDayStart } from "./snapshot";
import {
  objectStore,
  objectKey,
  objectRetention,
  storageIdentity,
} from "./storage";

const parquetCheck = z.object({
  row_count: z.number(),
  id_count: z.number(),
  timestamp_count: z.number(),
  type_count: z.number(),
  property_count: z.number(),
  // Nullable columns are scanned so every page is decompressed, not compared.
  session_count: z.number(),
  person_count: z.number(),
});
import { eventSelect, readCatalog } from "./catalog";
const monthEnd = (start: number) => {
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return end.getTime();
};
// Late events (offline clients, retries) still reach SQLite for a week after a
// month ends. After that the month lives only in S3 and changes only by backfill.
const archiveDelay = 7 * 86400_000;
const archivable = (start: number, dayStart: number) =>
  monthEnd(start) + archiveDelay <= dayStart;
async function sha256(path: string) {
  const hasher = new Bun.CryptoHasher("sha256"),
    reader = Bun.file(path).stream().getReader();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) return hasher.digest("hex");
    hasher.update(chunk.value);
  }
}
// Reads the stored object back rather than trusting the upload response: the
// bytes must hash to the published checksum and decode completely as Parquet.
async function downloadVerified(
  conn: DuckDBConnection,
  project: string,
  file: Pick<
    z.infer<typeof catalogFile>,
    "name" | "checksum" | "filesize" | "eventCount"
  >,
  dir: string,
) {
  const target = join(dir, `verify-${crypto.randomUUID()}.parquet`);
  await Bun.write(target, objectStore.file(objectKey(project, file.name)));
  if (
    statSync(target).size !== file.filesize ||
    (await sha256(target)) !== file.checksum
  )
    throw new Error(`Stored object ${file.name} does not match its checksum`);
  const check = parquetCheck.parse(
    (
      await conn.runAndReadAll(
        `SELECT count(*)::INTEGER row_count,count(DISTINCT id)::INTEGER id_count,count(timestamp)::INTEGER timestamp_count,count(event_type)::INTEGER type_count,count(properties)::INTEGER property_count,count(session_id)::INTEGER session_count,count(person_id)::INTEGER person_count FROM read_parquet(${sqlString(target)})`,
      )
    ).getRowObjectsJS()[0],
  );
  if (
    [
      check.row_count,
      check.id_count,
      check.timestamp_count,
      check.type_count,
      check.property_count,
    ].some((value) => value !== file.eventCount)
  )
    throw new Error(`Stored object ${file.name} has unexpected rows`);
  return target;
}
const exportsInFlight = new Map<
  string,
  Promise<z.infer<typeof catalogAccess>[]>
>();
export function exportProject(db: Database, project: string) {
  const pending = exportsInFlight.get(project);
  if (pending) return pending;
  const dayStart = utcDayStart();
  // A new destination requires fresh snapshots from authoritative SQLite.
  const destination = z
    .object({ value: z.string() })
    .nullable()
    .parse(
      db.query("SELECT value FROM settings WHERE key='parquet_storage'").get(),
    );
  if (
    destination?.value !== storageIdentity &&
    db.query("SELECT partition FROM archived_partitions LIMIT 1").get()
  ) {
    // Archived months exist only in the previous destination; re-exporting from
    // SQLite would publish them empty. Copy the objects and restore the setting.
    db.query(
      "INSERT INTO jobs(id,revision) VALUES(1,?) ON CONFLICT(id) DO NOTHING",
    ).run(Number(setting(db, "revision")));
    return Promise.reject(
      new Error(
        "S3 destination changed but archived months exist only in the previous destination",
      ),
    );
  }
  if (destination?.value !== storageIdentity)
    db.transaction(() => {
      db.exec("DELETE FROM export_manifest; DELETE FROM catalog;");
      const revision = Number(setting(db, "revision"));
      db.query(
        "INSERT INTO dirty_partitions SELECT DISTINCT strftime('%Y-%m', timestamp / 1000.0, 'unixepoch'), ? FROM events WHERE timestamp<? ON CONFLICT(partition) DO UPDATE SET revision=excluded.revision",
      ).run(revision, dayStart);
      if (db.query("SELECT partition FROM dirty_partitions LIMIT 1").get())
        db.query(
          "INSERT INTO jobs(id,revision) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision",
        ).run(revision);
      setSetting(db, "parquet_storage", storageIdentity);
      setSetting(db, "exported_revision", "0");
      db.query("DELETE FROM settings WHERE key='export_checked_day'").run();
      db.query("DELETE FROM settings WHERE key='exported_at'").run();
    }).immediate();
  // Discover new closed days once per UTC day, including days closed while down.
  // Today's ingestion does not dirty history or cause S3 writes.
  const checkedDay = z
    .object({ value: z.string() })
    .nullable()
    .parse(
      db
        .query("SELECT value FROM settings WHERE key='export_checked_day'")
        .get(),
    );
  if (checkedDay?.value !== String(dayStart)) {
    db.transaction(() => {
      const revision = Number(setting(db, "revision"));
      const partitions = z
        .array(z.object({ partition: z.string() }))
        .parse(
          db
            .query(
              "SELECT DISTINCT strftime('%Y-%m',timestamp/1000,'unixepoch') partition FROM events WHERE timestamp<?",
            )
            .all(dayStart),
        );
      const manifest = new Map(
        readCatalog(db, project).map((file) => [file.partition, file]),
      );
      for (const { partition } of partitions) {
        const nextMonth = monthEnd(Date.parse(partition + "-01T00:00:00Z"));
        const end = Math.min(nextMonth, dayStart);
        // A month past its grace period still holding SQLite rows is due for archiving.
        if (
          Date.parse(manifest.get(partition)?.end ?? "") !== end ||
          archivable(Date.parse(partition + "-01T00:00:00Z"), dayStart)
        )
          db.query(
            "INSERT INTO dirty_partitions VALUES(?,?) ON CONFLICT(partition) DO UPDATE SET revision=excluded.revision",
          ).run(partition, revision);
      }
      setSetting(db, "export_checked_day", String(dayStart));
    }).immediate();
  }
  if (!db.query("SELECT partition FROM dirty_partitions LIMIT 1").get())
    return Promise.resolve(readCatalog(db, project));
  db.query(
    "INSERT INTO jobs(id,revision) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET revision=max(revision,excluded.revision)",
  ).run(Number(setting(db, "revision")));
  const deferred = z
    .object({ value: z.string() })
    .nullable()
    .parse(
      db
        .query("SELECT value FROM settings WHERE key='export_deferred_until'")
        .get(),
    );
  // Catalog refreshes and the background worker share the same bulk-import delay.
  // An export already in flight may finish; revision checks preserve newer work.
  if (deferred && Number(deferred.value) > Date.now())
    return Promise.resolve(readCatalog(db, project));
  const task = writeExport(db, project).finally(() =>
    exportsInFlight.delete(project),
  );
  exportsInFlight.set(project, task);
  return task;
}
async function writeExport(db: Database, project: string) {
  const dayStart = utcDayStart();
  const dir = mkdtempSync(join(tmpdir(), "quacklytics-export-"));
  let instance: DuckDBInstance | undefined;
  let conn: DuckDBConnection | undefined;
  const snapshots: {
    partition: string;
    revision: number;
    live: number;
    start: number;
    end: number;
    stored: string | undefined;
  }[] = [];
  let revision = 0;
  try {
    instance = await DuckDBInstance.create();
    conn = await instance.connect();
    await createEventsTable(conn);
    // Backfilled rows for an archived month merge into its verified stored copy,
    // which is the only place the rest of that month exists.
    const stored = new Map<string, string>();
    for (const row of z
      .array(z.object({ partition: z.string(), json: z.string() }))
      .parse(
        db
          .query(
            "SELECT m.partition,m.json FROM dirty_partitions d JOIN archived_partitions a ON a.partition=d.partition JOIN export_manifest m ON m.partition=d.partition",
          )
          .all(),
      ))
      stored.set(
        row.partition,
        await downloadVerified(
          conn,
          project,
          catalogFile.parse(parseJson(row.json)),
          dir,
        ),
      );
    const appender = await conn.createAppender("events");
    try {
      // One SQLite read transaction captures a consistent revision across all dirty months.
      db.transaction(() => {
        revision = Number(setting(db, "revision"));
        const dirty = z
          .array(z.object({ partition: z.string(), revision: z.number() }))
          .parse(
            db.query("SELECT * FROM dirty_partitions ORDER BY partition").all(),
          );
        for (const part of dirty) {
          const start = Date.parse(part.partition + "-01T00:00:00Z");
          const end = Math.min(monthEnd(start), dayStart);
          const storedPath = stored.get(part.partition);
          // Backfilled while stored months downloaded; the next pass merges it.
          if (
            !storedPath &&
            db
              .query("SELECT 1 FROM archived_partitions WHERE partition=?")
              .get(part.partition)
          )
            continue;
          if (start >= end) {
            db.query(
              "DELETE FROM dirty_partitions WHERE partition=? AND revision<=?",
            ).run(part.partition, part.revision);
            continue;
          }
          let live = 0;
          for (const raw of db
            .query(
              eventSelect +
                " WHERE e.timestamp>=? AND e.timestamp<? ORDER BY e.timestamp,e.id",
            )
            .iterate(start, end)) {
            appendEvent(appender, raw);
            live++;
          }
          if (!live && !storedPath) {
            db.query(
              "DELETE FROM dirty_partitions WHERE partition=? AND revision<=?",
            ).run(part.partition, part.revision);
            continue;
          }
          snapshots.push({ ...part, live, start, end, stored: storedPath });
        }
      }).immediate();
    } finally {
      appender.closeSync();
    }
    if (!snapshots.length) return readCatalog(db, project);
    const files: {
      file: z.infer<typeof catalogFile>;
      archive: boolean;
      live: number;
      first: number;
      last: number;
    }[] = [];
    for (const snapshot of snapshots) {
      const range = `timestamp>=epoch_ms(${snapshot.start}) AND timestamp<epoch_ms(${snapshot.end})`;
      if (snapshot.stored) {
        // Archived rows win, so re-sent events cannot duplicate or overwrite them.
        await conn.run(
          `DELETE FROM events WHERE id IN (SELECT id FROM read_parquet(${sqlString(snapshot.stored)}))`,
        );
        await conn.run(
          `INSERT INTO events SELECT * FROM read_parquet(${sqlString(snapshot.stored)})`,
        );
      }
      const stats = z
        .object({
          row_count: z.number(),
          first_ms: z.number(),
          last_ms: z.number(),
        })
        .parse(
          (
            await conn.runAndReadAll(
              `SELECT count(*)::INTEGER row_count,epoch_ms(min(timestamp))::DOUBLE first_ms,epoch_ms(max(timestamp))::DOUBLE last_ms FROM events WHERE ${range}`,
            )
          ).getRowObjectsJS()[0],
        );
      const name = `events-${snapshot.partition}-${snapshot.revision}-${crypto.randomUUID()}.parquet`;
      const target = join(dir, name);
      await conn.run(
        `COPY (SELECT * FROM events WHERE ${range}) TO ${sqlString(target)} (FORMAT PARQUET,COMPRESSION ZSTD)`,
      );
      await objectStore.write(objectKey(project, name), Bun.file(target), {
        type: "application/vnd.apache.parquet",
      });
      const file = {
        name,
        partition: snapshot.partition,
        start: new Date(snapshot.start).toISOString(),
        end: new Date(snapshot.end).toISOString(),
        validUntil: null,
        checksum: await sha256(target),
        filesize: statSync(target).size,
        eventCount: stats.row_count,
        revision: snapshot.revision,
      };
      const archive =
        snapshot.end === monthEnd(snapshot.start) &&
        archivable(snapshot.start, dayStart);
      // SQLite rows are deleted on publication and a superseded object an hour
      // later, so S3 must already hold an intact copy of an archived month.
      if (archive) await downloadVerified(conn, project, file, dir);
      files.push({
        file,
        archive,
        live: snapshot.live,
        first: stats.first_ms,
        last: stats.last_ms,
      });
    }
    // Publish only after every file is durable. Newer ingestion stays dirty for the next run.
    db.transaction(() => {
      for (const { file, archive, live, first, last } of files) {
        db.query(
          "UPDATE catalog SET json=json_set(json, '$.validUntil', ?) WHERE name=(SELECT json_extract(json, '$.name') FROM export_manifest WHERE partition=?)",
        ).run(
          new Date(Date.now() + objectRetention).toISOString(),
          file.partition,
        );
        db.query("INSERT INTO catalog VALUES(?,?)").run(
          file.name,
          JSON.stringify(file),
        );
        db.query(
          "INSERT INTO export_manifest VALUES(?,?) ON CONFLICT(partition) DO UPDATE SET json=excluded.json",
        ).run(file.partition, JSON.stringify(file));
        db.query(
          "DELETE FROM dirty_partitions WHERE partition=? AND revision<=?",
        ).run(file.partition, file.revision);
        // Rows ingested after the snapshot keep the month dirty and in SQLite.
        if (
          !archive ||
          db
            .query("SELECT 1 FROM dirty_partitions WHERE partition=?")
            .get(file.partition)
        )
          continue;
        const bounds = [Date.parse(file.start), Date.parse(file.end)];
        const held = z
          .object({ rows: z.number() })
          .parse(
            db
              .query(
                "SELECT count(*) rows FROM events WHERE timestamp>=? AND timestamp<?",
              )
              .get(...bounds),
          );
        if (held.rows !== live)
          throw new Error(
            `Month ${file.partition} changed without being marked dirty`,
          );
        db.query(
          "INSERT OR IGNORE INTO archived_event_types SELECT DISTINCT event_type FROM events WHERE timestamp>=? AND timestamp<?",
        ).run(...bounds);
        db.query("DELETE FROM events WHERE timestamp>=? AND timestamp<?").run(
          ...bounds,
        );
        db.query(
          "INSERT INTO archived_partitions VALUES(?,?,?) ON CONFLICT(partition) DO UPDATE SET first_timestamp=excluded.first_timestamp,last_timestamp=excluded.last_timestamp",
        ).run(file.partition, first, last);
      }
      db.query("DELETE FROM jobs WHERE revision<=?").run(revision);
      db.query("UPDATE jobs SET error=NULL").run();
      setSetting(db, "exported_revision", String(revision));
      setSetting(db, "exported_at", new Date().toISOString());
    }).immediate();
    return readCatalog(db, project);
  } finally {
    conn?.closeSync();
    instance?.closeSync();
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function cleanupExports(db: Database, project: string) {
  // Until an export adopts the configured destination, the catalog describes
  // objects stored elsewhere.
  const destination = z
    .object({ value: z.string() })
    .nullable()
    .parse(
      db.query("SELECT value FROM settings WHERE key='parquet_storage'").get(),
    );
  if (exportsInFlight.has(project) || destination?.value !== storageIdentity)
    return;
  const expired = z
    .array(z.object({ name: z.string() }))
    .parse(
      db
        .query(
          "SELECT name FROM catalog WHERE json_extract(json, '$.validUntil') < ?",
        )
        .all(new Date().toISOString()),
    );
  for (const file of expired) {
    await objectStore.delete(objectKey(project, file.name));
    db.query("DELETE FROM catalog WHERE name=?").run(file.name);
  }
  // Reclaim uploads interrupted before manifest publication, including process
  // crashes, and the live files of agent datasets.
  const retained = new Set(
    z
      .array(z.object({ name: z.string() }))
      .parse(db.query("SELECT name FROM catalog").all())
      .map((file) => objectKey(project, file.name)),
  );
  let continuationToken: string | undefined;
  do {
    const page = await objectStore.list({
      prefix: `projects/${project}/`,
      ...(continuationToken ? { continuationToken } : {}),
    });
    for (const object of page.contents ?? []) {
      if (
        object.lastModified &&
        !retained.has(object.key) &&
        Date.parse(object.lastModified) < Date.now() - objectRetention
      )
        await objectStore.delete(object.key);
    }
    continuationToken = page.isTruncated
      ? page.nextContinuationToken
      : undefined;
  } while (continuationToken);
}
