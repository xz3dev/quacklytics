import { filter as filterSchema } from "@quacklytics/contracts";
import type { Field, FieldFilter } from "@/model/filters";
import type { QueryParamValue } from "@/lib/queries";

export type SqlCast = "VARCHAR" | "DOUBLE" | "FLOAT" | "BOOLEAN";
export const quoteIdentifier = (name: string) =>
  `"${name.replaceAll('"', '""')}"`;
const quoteLiteral = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** Property names are literal keys; an explicit $. prefix denotes a JSON path. */
export function fieldExpression(
  field: Field,
  cast?: SqlCast,
  tableAlias?: string,
): string {
  const prefix = tableAlias ? `${quoteIdentifier(tableAlias)}.` : "";
  let expression: string;
  if (field.isProperty || field.name.startsWith("$.")) {
    const path = quoteLiteral(
      field.name.startsWith("$.")
        ? field.name
        : `$.${JSON.stringify(field.name)}`,
    );
    const column = `${prefix}"properties"`;
    expression = `COALESCE(json_extract_string(${column}, ${path}), json_extract_string(json_extract_string(${column}, '$'), ${path}))`;
  } else if (field.name === "COALESCE(person_id, session_id)") {
    expression = `COALESCE(${prefix}"person_id", ${prefix}"session_id")`;
  } else if (
    /^time_bucket\(INTERVAL '1 (hour|day|week|month)s?', timestamp, epoch_ms\(-?\d+::bigint\)\)$/.test(
      field.name,
    )
  ) {
    // Compatibility with the structured time buckets produced by buildGroupByFilter.
    expression = field.name.replace(", timestamp,", `, ${prefix}"timestamp",`);
  } else {
    expression = `${prefix}${quoteIdentifier(field.name)}`;
  }
  return cast ? `TRY_CAST(${expression} AS ${cast})` : expression;
}

export function buildWhereClause(
  filters: FieldFilter[] | undefined,
  params: QueryParamValue[],
  tableAlias?: string,
): string {
  return (filters ?? [])
    .map((input) => {
      const { field, operator, value } = filterSchema.parse(input);
      const expression = fieldExpression(field, undefined, tableAlias);
      if (value instanceof Date) {
        if (operator === "IN" || operator === "LIKE")
          throw new Error("Dates require a comparison operator.");
        params.push(value.getTime());
        return `${expression} ${operator} epoch_ms(?::BIGINT)`;
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
          if (!String(entry).trim() || !Number.isFinite(number))
            throw new Error(`Enter a valid number for ${field.name}.`);
          params.push(number);
        } else if (cast === "BOOLEAN") {
          const boolean = String(entry).toLowerCase();
          if (boolean !== "true" && boolean !== "false")
            throw new Error(`Enter true or false for ${field.name}.`);
          params.push(boolean === "true");
        } else params.push(entry);
      }
      const placeholders = values.map(() => `CAST(? AS ${cast})`).join(", ");
      return `TRY_CAST(${expression} AS ${cast}) ${operator} ${operator === "IN" ? `(${placeholders})` : placeholders}`;
    })
    .join(" AND ");
}
