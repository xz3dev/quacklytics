import { z } from "zod";
import type { Database } from "bun:sqlite";
import {
  catalogFile,
  parseJson,
  analyticsStatus,
} from "@quacklytics/contracts";
import { setting } from "../db/database";
import { objectAccess, storageIdentity } from "./storage";
export const eventSelect =
  "SELECT e.id,e.timestamp,e.event_type,e.session_id,CASE WHEN coalesce(e.user_id,i.user_id) IS NOT NULL THEN 'user:' || coalesce(e.user_id,i.user_id) WHEN e.anonymous_id IS NOT NULL THEN 'anonymous:' || e.anonymous_id ELSE coalesce(e.person_id,s.person_id) END person_id,e.properties FROM events e LEFT JOIN sessions s ON s.id=e.session_id LEFT JOIN identity_links i ON i.anonymous_id=e.anonymous_id";
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

export function readAnalyticsStatus(db: Database, project: string) {
  // The manifest and revisions must describe the same committed snapshot.
  return db.transaction(() => {
    const value = (key: string) =>
      z
        .object({ value: z.string() })
        .nullable()
        .parse(db.query("SELECT value FROM settings WHERE key=?").get(key))
        ?.value;
    const destinationMatches = value("parquet_storage") === storageIdentity;
    const committedRevision = Number(setting(db, "revision"));
    const files = destinationMatches ? readCatalog(db, project) : [];
    // Existing stores predate the explicit publication watermark.
    const exportedRevision = destinationMatches
      ? Number(
          value("exported_revision") ??
            Math.max(0, ...files.map((file) => file.revision)),
        )
      : 0;
    const job = z
      .object({ error: z.string().nullable() })
      .nullable()
      .parse(db.query("SELECT error FROM jobs WHERE id=1").get());
    return analyticsStatus.parse({
      files,
      committedRevision,
      exportedRevision,
      exportedAt: destinationMatches ? (value("exported_at") ?? null) : null,
      pending:
        Boolean(
          db.query("SELECT partition FROM dirty_partitions LIMIT 1").get(),
        ) ||
        (value("export_checked_day") !==
          String(Date.parse(new Date().toISOString().slice(0, 10))) &&
          Boolean(
            db
              .query("SELECT id FROM events WHERE timestamp<? LIMIT 1")
              .get(Date.parse(new Date().toISOString().slice(0, 10))),
          )),
      exportError: job?.error
        ? "Event export failed. Retrying automatically."
        : null,
    });
  })();
}
