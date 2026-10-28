import {
  type DuckDBAppender,
  type DuckDBConnection,
  DuckDBInstance,
} from "@duckdb/node-api";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { z } from "zod";
import { projectDatabase } from "../db/database";
import { appendEvent, createEventsTable, sqlString } from "./parquet";
import type { dataset } from "./protocol";
import { readCoverage } from "./snapshot";
import {
  objectAccess,
  objectKey,
  objectRetention,
  objectStore,
} from "./storage";

// Agents accept slightly stale data in exchange for far fewer S3 uploads.
const reuseAge = 600_000;

// Appends the events no published file covers and returns those files. One read
// transaction makes both together cover every event exactly once.
async function appendLiveEvents(project: string, appender: DuckDBAppender) {
  try {
    // Opened right before its synchronous use: idle eviction can close a
    // project's handle while other work awaits.
    const db = await projectDatabase(project);
    return db.transaction(() => {
      const coverage = readCoverage(db, project);
      let liveCount = 0;
      for (const row of db
        .query(coverage.live.sql)
        .iterate(...coverage.live.params)) {
        appendEvent(appender, row);
        liveCount++;
      }
      return {
        capturedAt: Date.now(),
        availableStart: coverage.availableStart,
        availableEnd: coverage.availableEnd,
        eventCount: coverage.files.reduce(
          (total, file) => total + file.eventCount,
          liveCount,
        ),
        files: coverage.files.map((file) => file.name),
      };
    })();
  } finally {
    appender.closeSync();
  }
}

// The unpublished rows become one Parquet file shaped like the monthly ones. No
// catalog lists it, so export cleanup deletes it after objectRetention.
async function capture(project: string) {
  const dir = mkdtempSync(join(tmpdir(), "quacklytics-dataset-"));
  let instance: DuckDBInstance | undefined;
  let conn: DuckDBConnection | undefined;
  try {
    instance = await DuckDBInstance.create();
    conn = await instance.connect();
    await createEventsTable(conn);
    const snapshot = await appendLiveEvents(
      project,
      await conn.createAppender("events"),
    );
    const target = join(dir, "live.parquet");
    await conn.run(
      `COPY events TO ${sqlString(target)} (FORMAT PARQUET,COMPRESSION ZSTD)`,
    );
    const live = `live/events-${crypto.randomUUID()}.parquet`;
    await objectStore.write(objectKey(project, live), Bun.file(target), {
      type: "application/vnd.apache.parquet",
    });
    return { ...snapshot, files: [...snapshot.files, live] };
  } finally {
    conn?.closeSync();
    instance?.closeSync();
    rmSync(dir, { recursive: true, force: true });
  }
}
type Capture = Awaited<ReturnType<typeof capture>>;
// The export worker is long-lived; after a restart the next request captures anew.
const captures = new Map<string, Promise<Capture>>();

async function currentCapture(project: string) {
  for (;;) {
    const pending = captures.get(project);
    if (pending) {
      const value = await pending.catch(() => undefined);
      // Another request replaced a stale capture meanwhile; share that one.
      if (captures.get(project) !== pending) continue;
      if (value && Date.now() - value.capturedAt < reuseAge) return value;
    }
    const next = capture(project);
    captures.set(project, next);
    next.catch(() => {
      if (captures.get(project) === next) captures.delete(project);
    });
    return await next;
  }
}

export async function readDataset(
  project: string,
): Promise<z.infer<typeof dataset>> {
  const value = await currentCapture(project);
  // URLs must expire before cleanup may delete an object they reference: the
  // live file, and months replaced after the capture, outlive it by objectRetention.
  const age = Math.max(0, Date.now() - value.capturedAt);
  const expiresIn = Math.floor((objectRetention - age) / 1000) - 60;
  const urls = value.files.map(
    (name) => objectAccess(project, name, expiresIn).url,
  );
  return {
    setupSql: `CREATE OR REPLACE VIEW events AS SELECT * FROM read_parquet([${urls.map(sqlString).join(", ")}]);`,
    eventCount: value.eventCount,
    availableStart: value.availableStart,
    availableEnd: value.availableEnd,
    capturedAt: new Date(value.capturedAt).toISOString(),
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
  };
}
