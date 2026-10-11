import type { Database } from "bun:sqlite";
import { z } from "zod";
import { parseJson, type ProjectSetup } from "@quacklytics/contracts";
import { setting } from "../db/database";
import { eventSelect } from "../exports/catalog";
import { setupDiagnostics } from "../ingestion/diagnostics";

const eventRow = z
  .object({
    id: z.string(),
    timestamp: z.number(),
    event_type: z.string(),
    session_id: z.string().nullable(),
    person_id: z.string().nullable(),
    properties: z.string(),
  })
  .nullable();
const sdkContext = z.object({
  $context: z.object({
    sdk: z.object({ name: z.string(), version: z.string() }),
  }),
});

/** What the setup flow needs to verify a project's first events. */
export function projectSetup(db: Database, project: string): ProjectSetup {
  const row = eventRow.parse(
    db.query(eventSelect + " ORDER BY e.seq DESC LIMIT 1").get(),
  );
  const allowed = z
    .array(z.string())
    .parse(parseJson(setting(db, "cors_origins")));
  const sdk = row && sdkContext.safeParse(parseJson(row.properties));
  return {
    latestEvent: row && {
      id: row.id,
      eventType: row.event_type,
      timestamp: row.timestamp,
      sessionId: row.session_id,
      personId: row.person_id,
      sdk: sdk?.success ? sdk.data.$context.sdk : null,
    },
    ...setupDiagnostics(project, allowed),
  };
}
