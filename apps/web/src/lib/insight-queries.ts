import { Field, FieldFilter } from "@/model/filters.ts";
import { getFieldExpression } from "@lib/field.ts";
import { QueryParamValue } from "@lib/queries.ts";
import { Aggregation } from "@lib/aggregations.ts";
import { BreakdownInsightConfig } from "@/model/insights/breakdown-insight.ts";
import { RetentionInsightConfig } from "@/model/insights/retention-insight.ts";
import { PathInsightConfig } from "@/model/insights/path-insight.ts";
import { determineDateRange } from "@/model/insights/insight-date-range.ts";

type BuiltQuery = {
  sql: string;
  params: QueryParamValue[];
};

export function buildBreakdownQuery(
  config: BreakdownInsightConfig,
): BuiltQuery {
  const { start, end } = determineDateRange(config.duration);
  const params: QueryParamValue[] = [];
  const dimensionExpr = nullableLabelExpression(
    getAliasedFieldExpression(config.dimension),
  );
  const aggregationExpr = buildAggregationExpression(config.aggregation);
  const where = buildWhereClause(
    [dateFilter(">=", start), dateFilter("<=", end), ...(config.filters ?? [])],
    params,
  );
  const limit = safeLimit(config.limit, 10);

  return {
    sql: `
            SELECT
                ${dimensionExpr} AS dimension_value,
                ${aggregationExpr} AS result_value
            FROM events
            ${where ? `WHERE ${where}` : ""}
            GROUP BY dimension_value
            ORDER BY result_value DESC
            LIMIT ${limit}
        `.trim(),
    params,
  };
}

export function buildRetentionQuery(
  config: RetentionInsightConfig,
): BuiltQuery {
  const { start, end } = determineDateRange(config.duration);
  const params: QueryParamValue[] = [];
  const activationWhere = buildWhereClause(
    [
      dateFilter(">=", start),
      dateFilter("<=", end),
      ...(config.activationQuery.filters ?? []),
    ],
    params,
  );
  const returnWhere = buildWhereClause(
    [
      dateFilter(">=", start),
      dateFilter("<=", end),
      ...(config.returnQuery.filters ?? []),
    ],
    params,
    "e",
  );
  const bucket = retentionBucket(config.cohortBucket);
  const maxPeriods = safeLimit(config.maxPeriods, 14);

  return {
    sql: `
            WITH activation_events AS (
                SELECT
                    COALESCE(person_id, session_id) AS actor_id,
                    timestamp
                FROM events
                ${activationWhere ? `WHERE ${activationWhere}` : ""}
                    ${activationWhere ? "AND" : "WHERE"} COALESCE(person_id, session_id) IS NOT NULL
            ),
            activation AS (
                SELECT
                    actor_id,
                    MIN(timestamp) AS activation_time
                FROM activation_events
                GROUP BY actor_id
            ),
            cohorts AS (
                SELECT
                    actor_id,
                    activation_time,
                    time_bucket(INTERVAL '${bucket.interval}', activation_time, epoch_ms(${start.getTime()}::BIGINT)) AS cohort_start
                FROM activation
            ),
            return_events AS (
                SELECT
                    COALESCE(e.person_id, e.session_id) AS actor_id,
                    e.timestamp AS return_time
                FROM events e
                ${returnWhere ? `WHERE ${returnWhere}` : ""}
                    ${returnWhere ? "AND" : "WHERE"} COALESCE(e.person_id, e.session_id) IS NOT NULL
            ),
            returned AS (
                SELECT DISTINCT
                    c.cohort_start,
                    c.actor_id,
                    date_diff('${bucket.dateDiffPart}', date_trunc('${bucket.dateDiffPart}', c.activation_time), date_trunc('${bucket.dateDiffPart}', r.return_time)) AS period_index
                FROM cohorts c
                JOIN return_events r ON r.actor_id = c.actor_id
                WHERE r.return_time > c.activation_time
            ),
            cohort_sizes AS (
                SELECT
                    cohort_start,
                    0 AS period_index,
                    COUNT(DISTINCT actor_id) AS retained_count
                FROM cohorts
                GROUP BY cohort_start
            ),
            retained_counts AS (
                SELECT
                    cohort_start,
                    period_index,
                    COUNT(DISTINCT actor_id) AS retained_count
                FROM returned
                WHERE period_index BETWEEN 1 AND ${maxPeriods}
                GROUP BY cohort_start, period_index
            )
            SELECT * FROM cohort_sizes
            UNION ALL
            SELECT * FROM retained_counts
            ORDER BY cohort_start ASC, period_index ASC
        `.trim(),
    params,
  };
}

export function buildPathQuery(config: PathInsightConfig): BuiltQuery {
  const { start, end } = determineDateRange(config.duration);
  const params: QueryParamValue[] = [];
  const stepExpr = nullableLabelExpression(
    getAliasedFieldExpression(config.stepField),
  );
  // The anchor predicate appears before the date predicates in the SQL.
  const anchorWhere = buildWhereClause(
    config.anchorQuery.filters ?? [],
    params,
  );
  const where = buildWhereClause(
    [dateFilter(">=", start), dateFilter("<=", end)],
    params,
  );
  const transitionFunction = config.direction === "backward" ? "LAG" : "LEAD";
  const limit = safeLimit(config.limit, 10);
  const maxSteps = safeLimit(config.maxSteps, 1);
  const transitionColumns = Array.from({ length: maxSteps }, (_, index) => {
    const distance = index + 1;
    return `${transitionFunction}(step_value, ${distance}) OVER (
                        PARTITION BY actor_id
                        ORDER BY timestamp ASC
                    ) AS target_step_${distance}`;
  }).join(",\n                    ");
  const unionedTransitions = Array.from({ length: maxSteps }, (_, index) => {
    const distance = index + 1;
    return `SELECT source_step, target_step_${distance} AS target_step, ${distance} AS step_distance FROM sequenced WHERE is_anchor`;
  }).join("\n                UNION ALL\n                ");

  return {
    sql: `
            WITH filtered AS (
                SELECT
                    COALESCE(person_id, session_id) AS actor_id,
                    timestamp,
                    (${anchorWhere || "TRUE"}) AS is_anchor,
                    ${stepExpr} AS step_value
                FROM events
                ${where ? `WHERE ${where}` : ""}
                    ${where ? "AND" : "WHERE"} COALESCE(person_id, session_id) IS NOT NULL
            ),
            sequenced AS (
                SELECT
                    step_value AS source_step,
                    is_anchor,
                    ${transitionColumns}
                FROM filtered
            ),
            transitions AS (
                ${unionedTransitions}
            )
            SELECT
                source_step,
                target_step,
                step_distance,
                COUNT(*) AS result_value
            FROM transitions
            WHERE target_step IS NOT NULL
            GROUP BY source_step, target_step, step_distance
            ORDER BY result_value DESC, step_distance ASC, source_step ASC, target_step ASC
            LIMIT ${limit}
        `.trim(),
    params,
  };
}

function buildAggregationExpression(aggregation: Aggregation): string {
  const castType = aggregation.function === "COUNT" ? undefined : "FLOAT";
  const fieldExpr = getFieldExpression(aggregation.field, castType);
  const distinct = aggregation.distinct ? "DISTINCT " : "";
  return `${aggregation.function}(${distinct}${fieldExpr})`;
}

function buildWhereClause(
  filters: FieldFilter[],
  params: QueryParamValue[],
  tableAlias?: string,
): string {
  const clauses: string[] = [];

  for (const filter of filters) {
    const fieldExpr = getAliasedFieldExpression(
      filter.field,
      undefined,
      tableAlias,
    );
    let placeholder = "?";
    if (filter.value instanceof Date) {
      placeholder = "epoch_ms(?::BIGINT)";
      params.push(filter.value.getTime());
    } else if (typeof filter.value === "number") {
      placeholder = "?::DOUBLE";
      params.push(filter.value);
    } else {
      params.push(filter.value);
    }

    clauses.push(`${fieldExpr} ${filter.operator} ${placeholder}`);
  }

  return clauses.join(" AND ");
}

function dateFilter(operator: ">=" | "<=", value: Date): FieldFilter {
  return {
    field: {
      name: "timestamp",
      type: "number",
    },
    operator,
    value,
  };
}

function getAliasedFieldExpression(
  field: Field,
  castType?: string,
  tableAlias?: string,
): string {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  const isJsonField = field.name.startsWith("$.") || field.isProperty;
  if (isJsonField) {
    const jsonPath = field.name.startsWith("$.")
      ? field.name
      : `$.${field.name}`;
    return `CAST(COALESCE(json_extract_string(${prefix}properties, '${jsonPath}'), json_extract_string(json_extract_string(${prefix}properties, '$'), '${jsonPath}')) AS ${castType ?? "VARCHAR"})`;
  }
  if (field.name.includes("(")) {
    return field.name;
  }
  return castType
    ? `CAST(${prefix}${field.name} AS ${castType})`
    : `${prefix}${field.name}`;
}

function nullableLabelExpression(expression: string): string {
  return `COALESCE(NULLIF(CAST(${expression} AS VARCHAR), ''), '(missing)')`;
}

function safeLimit(limit: number | undefined, fallback: number): number {
  if (!limit || !Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

function retentionBucket(bucket: RetentionInsightConfig["cohortBucket"]) {
  switch (bucket) {
    case "Weekly":
      return { interval: "1 week", dateDiffPart: "week" };
    case "Monthly":
      return { interval: "1 month", dateDiffPart: "month" };
    case "Hourly":
      return { interval: "1 hour", dateDiffPart: "hour" };
    case "Daily":
    default:
      return { interval: "1 day", dateDiffPart: "day" };
  }
}
