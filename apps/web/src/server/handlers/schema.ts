import { z } from "zod";
import { readSchema } from "../domain/schema";
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
  return json(readSchema(db));
}
