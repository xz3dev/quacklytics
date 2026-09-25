import {
  DuckDBInstance,
  type DuckDBConnection,
  timestampValue,
} from "@duckdb/node-api";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { catalogFile, catalogAccess, parseJson } from "@quacklytics/contracts";
import type { Database } from "bun:sqlite";
import { setting, setSetting } from "../db/database";

import {
  objectStore,
  objectKey,
  objectAccess,
  storageIdentity,
} from "./storage";

const exportRow = z.object({
  id: z.string(),
  timestamp: z.number(),
  event_type: z.string(),
  session_id: z.string().nullable(),
  person_id: z.string().nullable(),
  properties: z.string(),
});
export const eventSelect =
  "SELECT e.id,e.timestamp,e.event_type,e.session_id,coalesce(e.person_id,s.person_id) person_id,e.properties FROM events e LEFT JOIN sessions s ON s.id=e.session_id";
const exportsInFlight = new Map<
  string,
  Promise<z.infer<typeof catalogAccess>[]>
>();
export function exportProject(db: Database, project: string) {
  const pending = exportsInFlight.get(project);
  if (pending) return pending;
  // A new destination requires fresh snapshots from authoritative SQLite.
  const destination = z
    .object({ value: z.string() })
    .nullable()
    .parse(
      db.query("SELECT value FROM settings WHERE key='parquet_storage'").get(),
    );
  if (destination?.value !== storageIdentity)
    db.transaction(() => {
      db.exec("DELETE FROM export_manifest; DELETE FROM catalog;");
      const revision = Number(setting(db, "revision"));
      db.query(
        "INSERT INTO dirty_partitions SELECT DISTINCT strftime('%Y-%m', timestamp / 1000.0, 'unixepoch'), ? FROM events WHERE true ON CONFLICT(partition) DO UPDATE SET revision=excluded.revision",
      ).run(revision);
      if (db.query("SELECT partition FROM dirty_partitions LIMIT 1").get())
        db.query(
          "INSERT INTO jobs(id,revision) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision",
        ).run(revision);
      setSetting(db, "parquet_storage", storageIdentity);
    })();
  if (!db.query("SELECT id FROM jobs LIMIT 1").get())
    return Promise.resolve(readCatalog(db, project));
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
export function readCatalog(db: Database, project: string) {
  const rows = z
    .array(z.object({ json: z.string() }))
    .parse(
      db.query("SELECT json FROM export_manifest ORDER BY partition").all(),
    );
  return rows.map((row) => {
    const file = catalogFile.parse(parseJson(row.json));
    return {
      ...file,
      ...objectAccess(project, file.name),
    };
  });
}
async function writeExport(db: Database, project: string) {
  const dir = mkdtempSync(join(tmpdir(), "quacklytics-export-"));
  let instance: DuckDBInstance | undefined;
  let conn: DuckDBConnection | undefined;
  const snapshots: {
    partition: string;
    revision: number;
    count: number;
    start: number;
    end: number;
  }[] = [];
  let revision = 0;
  try {
    instance = await DuckDBInstance.create();
    conn = await instance.connect();
    await conn.run(
      "CREATE TABLE events(id VARCHAR,timestamp TIMESTAMP,event_type VARCHAR,session_id VARCHAR,person_id VARCHAR,properties JSON)",
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
          const endDate = new Date(start);
          endDate.setUTCMonth(endDate.getUTCMonth() + 1);
          const end = endDate.getTime();
          let count = 0;
          for (const raw of db
            .query(
              eventSelect +
                " WHERE e.timestamp>=? AND e.timestamp<? ORDER BY e.timestamp,e.id",
            )
            .iterate(start, end)) {
            const row = exportRow.parse(raw);
            count++;
            appender.appendVarchar(row.id);
            appender.appendTimestamp(
              timestampValue(BigInt(row.timestamp) * 1000n),
            );
            appender.appendVarchar(row.event_type);
            row.session_id === null
              ? appender.appendNull()
              : appender.appendVarchar(row.session_id);
            row.person_id === null
              ? appender.appendNull()
              : appender.appendVarchar(row.person_id);
            appender.appendVarchar(row.properties);
            appender.endRow();
          }
          snapshots.push({ ...part, count, start, end });
        }
      })();
    } finally {
      appender.closeSync();
    }
    const files: z.infer<typeof catalogFile>[] = [];
    for (const snapshot of snapshots) {
      const name = `events-${snapshot.partition}-${snapshot.revision}-${crypto.randomUUID()}.parquet`;
      const target = join(dir, name);
      await conn.run(
        `COPY (SELECT * FROM events WHERE timestamp>=epoch_ms(${snapshot.start}) AND timestamp<epoch_ms(${snapshot.end})) TO '${target.replaceAll("'", "''")}' (FORMAT PARQUET,COMPRESSION ZSTD)`,
      );
      const hasher = new Bun.CryptoHasher("sha256"),
        reader = Bun.file(target).stream().getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        hasher.update(chunk.value);
      }
      await objectStore.write(objectKey(project, name), Bun.file(target), {
        type: "application/vnd.apache.parquet",
      });
      files.push({
        name,
        partition: snapshot.partition,
        start: new Date(snapshot.start).toISOString(),
        end: new Date(snapshot.end).toISOString(),
        validUntil: null,
        checksum: hasher.digest("hex"),
        filesize: statSync(target).size,
        eventCount: snapshot.count,
        revision: snapshot.revision,
      });
    }
    // Publish only after every file is durable. Newer ingestion stays dirty for the next run.
    db.transaction(() => {
      for (const file of files) {
        db.query(
          "UPDATE catalog SET json=json_set(json, '$.validUntil', ?) WHERE name=(SELECT json_extract(json, '$.name') FROM export_manifest WHERE partition=?)",
        ).run(new Date(Date.now() + 3600_000).toISOString(), file.partition);
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
      }
      db.query("DELETE FROM jobs WHERE revision<=?").run(revision);
    })();
    return readCatalog(db, project);
  } finally {
    conn?.closeSync();
    instance?.closeSync();
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function cleanupExports(db: Database, project: string) {
  if (exportsInFlight.has(project)) return;
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
  // Reclaim uploads interrupted before manifest publication, including process crashes.
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
        Date.parse(object.lastModified) < Date.now() - 3600_000
      )
        await objectStore.delete(object.key);
    }
    continuationToken = page.isTruncated
      ? page.nextContinuationToken
      : undefined;
  } while (continuationToken);
}
