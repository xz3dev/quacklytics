import { createContext, useContext } from "react";
import type { Field } from "@/model/filters";
import type { QueryParamValue } from "@/lib/queries";

export const ChartBreakdownContext = createContext<{
  field: Field;
  values: (string | null)[];
} | null>(null);

export function breakdownExpression(field: Field): string {
  if (field.isProperty || field.name.startsWith("$.")) {
    const path = (
      field.name.startsWith("$.") ? field.name : `$.${field.name}`
    ).replaceAll("'", "''");
    return `COALESCE(json_extract_string(properties, '${path}'), json_extract_string(json_extract_string(properties, '$'), '${path}'))`;
  }
  return `CAST("${field.name.replaceAll('"', '""')}" AS VARCHAR)`;
}

export function scopeBreakdownQuery(
  query: { sql: string; params: QueryParamValue[] },
  breakdown: React.ContextType<typeof ChartBreakdownContext>,
) {
  if (!breakdown) return query;
  const queries = breakdown.values.map((value, index) => ({
    sql: `(WITH events AS (SELECT * FROM main.events WHERE ${breakdownExpression(breakdown.field)} IS NOT DISTINCT FROM ?::VARCHAR) SELECT breakdown_result.*, ${index} AS __breakdown_index FROM (${query.sql.trim().replace(/;$/, "")}) AS breakdown_result)`,
    params: [value, ...query.params],
  }));
  return {
    sql: queries.map((query) => query.sql).join(" UNION ALL "),
    params: queries.flatMap((query) => query.params),
  };
}

export function useChartBreakdown() {
  return useContext(ChartBreakdownContext);
}

export function breakdownLabel(value: string | null): string {
  return value === null ? "(missing)" : value === "" ? "(empty)" : value;
}

export function breakdownColor(index: number): string {
  return `hsl(${(index * 137.508 + 220) % 360} 65% 48%)`;
}
