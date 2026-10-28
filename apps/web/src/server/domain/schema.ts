import type { Database } from "bun:sqlite";
import { z } from "zod";
/** Event types (including archived-only ones) mapped to their property fields. */
export function readSchema(db: Database) {
  const result: Record<
    string,
    Record<string, { id: number; type: string }>
  > = {};
  for (const row of z
    .array(z.object({ event_type: z.string() }))
    .parse(
      db
        .query(
          "SELECT DISTINCT event_type FROM events UNION SELECT event_type FROM archived_event_types",
        )
        .all(),
    ))
    result[row.event_type] = {};
  for (const row of z
    .array(
      z.object({
        id: z.number(),
        event_type: z.string(),
        name: z.string(),
        type: z.string(),
      }),
    )
    .parse(db.query("SELECT * FROM schemas").all())) {
    const fields = result[row.event_type] ?? {};
    fields[row.name] = { id: row.id, type: row.type };
    result[row.event_type] = fields;
  }
  return result;
}
