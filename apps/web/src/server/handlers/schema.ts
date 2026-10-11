import { z } from "zod";
import { json, type ProjectRequest } from "./shared";
export async function schemaHandler({
  db,
  idText,
  action,
  url,
}: ProjectRequest): Promise<Response> {
  if (idText === "prop") {
    const scope = z
      .enum(["event", "project"])
      .parse(url.searchParams.get("scope") ?? "event");
    return json(
      z
        .array(z.object({ value: z.string() }))
        .parse(
          db
            .query(
              scope === "project"
                ? "SELECT DISTINCT values_for_field.value FROM schema_values values_for_field JOIN schemas field ON field.id=values_for_field.property_id JOIN schemas selected ON selected.name=field.name AND selected.type=field.type WHERE selected.id=? ORDER BY values_for_field.value"
                : "SELECT value FROM schema_values WHERE property_id=? ORDER BY value",
            )
            .all(Number(action)),
        )
        .map((r) => r.value),
    );
  }
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
  return json(result);
}
