import type { QueryParamValue } from "@lib/queries";
import type {
  FunnelStep,
  FunnelInsightConfig,
} from "@/model/insights/funnel-insights";
import { buildWhereClause, quoteIdentifier } from "./sql/compiler";

/**
 * Builds a parameterized DuckDB SQL query string to calculate the total number of users
 * completing a funnel sequentially within a specified timeframe (summary view).
 * Returns the SQL string and an array of parameters.
 *
 * @param steps - An array of FunnelStep objects defining the funnel.
 * @param eventsTable - The name of the events table in DuckDB. Defaults to 'events'.
 * @param startDate - Optional start date for the analysis (inclusive). Can be Date object or ISO string.
 * @param endDate - Optional end date for the analysis (inclusive). Can be Date object or ISO string.
 * @returns An object containing the SQL query string and an array of parameters.
 */
export function buildFunnelQuery(
  steps: FunnelStep[],
  eventsTable: string = "events",
  startDate: Date | string,
  endDate: Date | string,
  countingMode: FunnelInsightConfig["countingMode"],
): { sql: string; params: QueryParamValue[] } {
  // Updated return type
  if (!steps || steps.length === 0) {
    return {
      sql: "",
      params: [],
    };
  }

  const params: QueryParamValue[] = []; // Initialize parameter array
  const ctes: string[] = [];
  const stepCompletionAliases: string[] = [];

  // --- Base Events CTE with Time Filter ---
  const timeFilterClause = buildWhereClause(
    [
      {
        field: { name: "timestamp", type: "timestamp" },
        operator: ">=",
        value: new Date(startDate),
      },
      {
        field: { name: "timestamp", type: "timestamp" },
        operator: "<=",
        value: new Date(endDate),
      },
    ],
    params,
  );
  const baseCteName = "Base_Events";
  const baseCteSql = `
    ${baseCteName} AS (
      SELECT * -- Select all columns needed downstream
      FROM ${quoteIdentifier(eventsTable)}
      ${timeFilterClause ? `WHERE ${timeFilterClause}` : "-- No time filter applied"}
    )
  `;
  ctes.push(baseCteSql);

  // --- Step Completion CTEs ---
  steps.forEach((step, index) => {
    const stepNum = index + 1;
    const cteName = `Step${stepNum}_Completion`;
    const stepAlias = `s${stepNum}`;
    stepCompletionAliases.push(stepAlias);
    const stepTimeAlias = `step${stepNum}_time`;

    const isFirstStep = index === 0;
    const prevCteName = isFirstStep ? "" : `Step${index}_Completion`;
    const prevStepAlias = isFirstStep ? "" : `s${index}`;
    const prevStepTimeAlias = isFirstStep ? "" : `step${index}_time`;
    const tableAlias = isFirstStep ? null : "e";
    const sourceTable = isFirstStep
      ? baseCteName
      : `${baseCteName} ${tableAlias}`;
    const actorExpression =
      countingMode === "uniqueSessions"
        ? `${tableAlias ? `${tableAlias}.` : ""}"session_id"`
        : `COALESCE(${tableAlias ? `${tableAlias}.` : ""}"person_id", ${tableAlias ? `${tableAlias}.` : ""}"session_id")`;

    // --- SELECT Clause (Summary Version) ---
    const selectClause = `
      SELECT
          ${actorExpression} AS "actor_id",
          MIN(${tableAlias ? `${tableAlias}.` : ""}"timestamp") AS ${stepTimeAlias},
          COUNT(*) AS "event_count"
    `;

    // --- FROM Clause ---
    const fromClause = isFirstStep
      ? `FROM ${sourceTable}`
      : `FROM ${sourceTable} JOIN ${prevCteName} ${prevStepAlias} ON ${actorExpression} = ${prevStepAlias}."actor_id"`;

    // --- WHERE Clause ---
    const whereConditions: string[] = [];
    if (!isFirstStep) {
      whereConditions.push(
        `${tableAlias}."timestamp" > ${prevStepAlias}.${prevStepTimeAlias}`,
      );
    }
    // Build parameterized WHERE clause for step filters
    const stepWhereClause = buildWhereClause(
      step.query.filters,
      params,
      tableAlias ?? undefined,
    ); // Pass params
    if (stepWhereClause) {
      // Add if not null
      whereConditions.push(stepWhereClause);
    }
    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // --- GROUP BY Clause ---
    const groupByClause = `GROUP BY ${actorExpression}`;

    // Assemble the Step CTE definition string
    const stepCteSql = `${cteName} AS (
      ${selectClause}
      ${fromClause}
      ${whereClause}
      ${groupByClause}
    )`;
    ctes.push(stepCteSql);
  });

  // --- Assemble Final SELECT Statement (Summary Version) ---
  let finalSelect = "SELECT\n";
  let finalFrom = `FROM Step1_Completion ${stepCompletionAliases[0]}\n`;

  steps.forEach((step, index) => {
    const currentAlias = stepCompletionAliases[index];
    // Use step name in alias, escape if necessary (basic escaping here)
    const safeAlias = step.name.replace(/[^a-zA-Z0-9_]/g, "_");
    const countExpression =
      countingMode === "eventCount"
        ? `COALESCE(SUM(${currentAlias}."event_count"), 0)`
        : `COUNT(${currentAlias}."actor_id")`;
    finalSelect += `    ${countExpression} AS "${safeAlias}_count"`;
    if (index > 0) {
      const previousAlias = stepCompletionAliases[index - 1];
      finalSelect += `, AVG(epoch(${currentAlias}.step${index + 1}_time) - epoch(${previousAlias}.step${index}_time)) AS "__step_${index}_seconds"`;
    }

    if (index < steps.length - 1) {
      finalSelect += ",\n";
    } else {
      finalSelect += "\n";
    }

    if (index < steps.length - 1) {
      const nextStepNum = index + 2;
      const nextAlias = stepCompletionAliases[index + 1];
      finalFrom += `LEFT JOIN Step${nextStepNum}_Completion ${nextAlias} ON ${currentAlias}."actor_id" = ${nextAlias}."actor_id"\n`;
    }
  });

  // --- Assemble the Full Query ---
  const fullQuery = `
    WITH ${ctes.join(",\n\n")}

    ${finalSelect}
    ${finalFrom};
  `;

  // Return the SQL string and the populated parameters array
  return { sql: fullQuery.trim(), params: params };
}
