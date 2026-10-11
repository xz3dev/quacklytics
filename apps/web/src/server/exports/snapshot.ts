import type { Database } from "bun:sqlite";
import { z } from "zod";
import {
  analyticsSnapshot,
  analyticsRow,
  parseJson,
} from "@quacklytics/contracts";
import { eventSelect, readAnalyticsStatus } from "./catalog";

export function utcDayStart() {
  return Date.parse(new Date().toISOString().slice(0, 10));
}

// Only clean, published coverage may be combined with SQLite. Replacing a dirty
// month with its SQLite rows also repairs historical identity changes immediately.
// Archived months exist only in S3: their file always covers the month, and
// backfilled rows appear once merged into it.
export function readSnapshot(db: Database, project: string) {
  return db.transaction(() => {
    const status = readAnalyticsStatus(db, project);
    const dirty = new Set(
      z
        .array(z.object({ partition: z.string() }))
        .parse(db.query("SELECT partition FROM dirty_partitions").all())
        .map((row) => row.partition),
    );
    const archived = new Set(
      z
        .array(z.object({ partition: z.string() }))
        .parse(db.query("SELECT partition FROM archived_partitions").all())
        .map((row) => row.partition),
    );
    const dayStart = utcDayStart();
    const files = status.files.filter(
      (file) =>
        archived.has(file.partition) ||
        (!dirty.has(file.partition) && Date.parse(file.end) <= dayStart),
    );
    const coverage = files.map((file) => ({
      start: Date.parse(file.start),
      end: Date.parse(file.end),
    }));
    // Query the complement of published ranges with positive timestamp bounds,
    // allowing SQLite's timestamp index to skip the historical Parquet coverage.
    const gaps: { start: number; end?: number }[] = [];
    let start = -8640000000000000;
    for (const range of coverage) {
      if (start < range.start) gaps.push({ start, end: range.start });
      start = Math.max(start, range.end);
    }
    gaps.push({ start });
    const predicates = gaps.map((range) =>
      range.end === undefined
        ? "e.timestamp>=?"
        : "(e.timestamp>=? AND e.timestamp<?)",
    );
    const rawRows = z
      .array(
        analyticsRow
          .omit({ properties: true })
          .extend({ properties: z.string() }),
      )
      .parse(
        db
          .query(
            eventSelect +
              ` WHERE (${predicates.join(" OR ")})` +
              " ORDER BY e.timestamp,e.id",
          )
          .all(
            ...gaps.flatMap((range) =>
              range.end === undefined
                ? [range.start]
                : [range.start, range.end],
            ),
          ),
      );
    const liveEvents = rawRows.map((row) =>
      analyticsRow.parse({ ...row, properties: parseJson(row.properties) }),
    );
    const bounds = z
      .object({ start: z.number().nullable(), end: z.number().nullable() })
      .parse(
        db
          .query(
            "SELECT min(first) start,max(last) end FROM (SELECT (SELECT min(timestamp) FROM events) first,(SELECT max(timestamp) FROM events) last UNION ALL SELECT min(first_timestamp),max(last_timestamp) FROM archived_partitions)",
          )
          .get(),
      );
    return analyticsSnapshot.parse({
      ...status,
      files,
      // Historical publication can lag without making the combined query stale.
      pending: false,
      dayStart: new Date(dayStart).toISOString(),
      liveEvents,
      availableStart:
        bounds.start === null ? null : new Date(bounds.start).toISOString(),
      availableEnd:
        bounds.end === null ? null : new Date(bounds.end + 1).toISOString(),
    });
  })();
}
