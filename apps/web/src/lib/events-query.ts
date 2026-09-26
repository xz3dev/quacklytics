import { filter as filterSchema } from "@quacklytics/contracts";
import type { FieldFilter } from "@/model/filters";
import type { QueryParamValue } from "@/lib/queries";

export function buildEventsQuery(filters: FieldFilter[]) {
  const params: QueryParamValue[] = [];
  const conditions = filters.map((input) => {
    const { field, operator, value } = filterSchema.parse(input);
    let expression: string;
    if (field.isProperty) {
      // Quote the JSON key and SQL literal separately; values remain bound parameters.
      const path = `$.${JSON.stringify(field.name)}`.replaceAll("'", "''");
      expression = `COALESCE(json_extract_string(properties, '${path}'), json_extract_string(json_extract_string(properties, '$'), '${path}'))`;
    } else {
      if (field.name !== "event_type")
        throw new Error("Unsupported event field");
      expression = "event_type";
    }
    const cast =
      operator === "LIKE"
        ? "VARCHAR"
        : field.type === "number"
          ? "DOUBLE"
          : field.type === "boolean"
            ? "BOOLEAN"
            : "VARCHAR";
    const values =
      operator === "IN"
        ? String(value)
            .split(",")
            .map((entry) => entry.trim())
        : [value];
    for (const entry of values) {
      if (cast === "DOUBLE") {
        const number = Number(entry);
        if (!String(entry).trim() || !Number.isFinite(number)) {
          throw new Error(`Enter a valid number for ${field.name}.`);
        }
        params.push(number);
      } else if (cast === "BOOLEAN") {
        const boolean = String(entry).toLowerCase();
        if (boolean !== "true" && boolean !== "false") {
          throw new Error(`Enter true or false for ${field.name}.`);
        }
        params.push(boolean === "true");
      } else {
        params.push(entry);
      }
    }
    const placeholders = values.map(() => `CAST(? AS ${cast})`).join(", ");
    return `TRY_CAST(${expression} AS ${cast}) ${operator} ${operator === "IN" ? `(${placeholders})` : placeholders}`;
  });
  return {
    sql: `SELECT * FROM events ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY timestamp DESC LIMIT 100`,
    params,
  };
}
