import type { FieldFilter } from "@/model/filters";
import type { QueryParamValue } from "@/lib/queries";
import { buildWhereClause } from "./sql/compiler";

export const EVENT_LIMITS = [100, 200, 500, 1000] as const;
export type EventLimit = (typeof EVENT_LIMITS)[number];

export function buildEventsQuery(
  filters: FieldFilter[],
  limit: EventLimit = 100,
) {
  for (const { field } of filters) {
    if (!field.isProperty && field.name !== "event_type")
      throw new Error("Unsupported event field");
  }
  const params: QueryParamValue[] = [];
  const where = buildWhereClause(filters, params);
  return {
    sql: `SELECT * FROM events ${where ? `WHERE ${where}` : ""} ORDER BY timestamp DESC LIMIT ${limit}`,
    params,
  };
}
