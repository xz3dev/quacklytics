// Assuming necessary imports are available:
import { QueryParamValue } from "@lib/queries.ts"; // Or adjust path
import { FieldFilter, Field } from "@/model/filters.ts"; // Assuming Field type is available
import { FunnelStep } from "@/model/insights/funnel-insights.ts"; // Or adjust path
// Assume getFieldExpression is available and imported, similar to its use in buildQuery
import { getFieldExpression } from "@lib/field.ts"; // Adjust path as needed

// --- Constants for SQL Conditions ---
// No longer strictly needed for WHERE clause logic, but can be kept for clarity if desired elsewhere
// const ALWAYS_TRUE = '1=1';
// const ALWAYS_FALSE = '1=0';

/**
 * Builds a parameterized SQL WHERE clause string specifically for timestamp filtering.
 * Uses epoch_ms for comparison, similar to the trend builder.
 * @param startDate Optional start date (inclusive).
 * @param endDate Optional end date (inclusive).
 * @param params The array to push parameter values onto.
 * @param timestampColumn Name of the timestamp column. Defaults to "timestamp".
 * @returns SQL condition string or null if no dates provided.
 */
function buildTimeFilterClause(
    startDate: Date | string,
    endDate: Date | string,
    params: QueryParamValue[], // Modifies this array
    timestampColumn: string = '"timestamp"'
): string | null {
    const startValue = startDate ? (startDate instanceof Date ? startDate : new Date(startDate)).getTime() : null;
    const endValue = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)).getTime() : null;

    if (startValue !== null && endValue !== null) {
        params.push(startValue, endValue);
        // Use epoch_ms for comparison
        return `${timestampColumn} BETWEEN epoch_ms(?::BIGINT) AND epoch_ms(?::BIGINT)`;
    } else if (startValue !== null) {
        params.push(startValue);
        return `${timestampColumn} >= epoch_ms(?::BIGINT)`;
    } else if (endValue !== null) {
        params.push(endValue);
        return `${timestampColumn} <= epoch_ms(?::BIGINT)`;
    }
    return null; // No date filters specified
}


/**
 * Builds a parameterized SQL WHERE clause string from an array of FieldFilter objects.
 * Pushes parameter values onto the provided params array.
 * Assumes existence of getFieldExpression helper.
 * @param filters - Array of filter conditions.
 * @param params - The array to push parameter values onto.
 * @param jsonColumn - Name of the JSON column in the table (defaults to 'properties').
 * @param tableAlias - Optional alias for the table (e.g., 'e') to prefix column names.
 * @returns A SQL WHERE clause string (e.g., "event_type" = ? AND "properties" ->> '$.prop' > ?) or null if no valid filters.
 */
function buildWhereClause(
    filters: FieldFilter[] | undefined,
    params: QueryParamValue[], // Modifies this array
    jsonColumn: string = 'properties',
    tableAlias: string | null = null
): string | null { // Return null if no conditions
    if (!filters || filters.length === 0) {
        return null; // No conditions
    }

    const conditions: string[] = [];

    filters.forEach(filter => {
        // Use assumed getFieldExpression helper
        // Pass tableAlias to getFieldExpression if it supports it
        const fieldExpr = getFieldExpression(filter.field, undefined, tableAlias); // Assuming getFieldExpression(field, castType?, alias?)
        const operator = (filter.operator as string).toUpperCase();
        const value = filter.value;

        switch (operator) {
            case '=':
            case '!=':
            case '<>':
                if (value === null || value === undefined) {
                    conditions.push(`${fieldExpr} ${operator === '=' ? 'IS NULL' : 'IS NOT NULL'}`);
                } else {
                    params.push(value);
                    conditions.push(`${fieldExpr} ${operator === '<>' ? '!=' : operator} ?`);
                }
                break;
            case '>':
            case '<':
            case '>=':
            case '<=':
                if (value === null || value === undefined) {
                    console.warn(`Attempting comparison (${operator}) with NULL for field ${filter.field.name}. This condition will be ignored.`);
                    // Don't add a condition like '1=0', just skip it.
                } else {
                    params.push(value);
                    conditions.push(`${fieldExpr} ${operator} ?`);
                }
                break;
            case 'IN':
            case 'NOT IN':
                if (!Array.isArray(value)) {
                    console.warn(`Value for ${operator} operator on field ${filter.field.name} is not an array. Condition ignored.`);
                } else if (value.length === 0) {
                    // WHERE col IN () is always false, WHERE col NOT IN () is always true.
                    // We can represent "always false" by adding a condition that's guaranteed false,
                    // or simply omit the filter if possible. For "always true", we just omit the filter.
                    if (operator === 'IN') {
                        conditions.push('1=0'); // Add an explicit always-false condition
                    }
                    // For NOT IN (), it's always true, so we add no condition.
                } else {
                    // Generate multiple placeholders: (?, ?, ?)
                    const placeholders = value.map(() => '?').join(', ');
                    value.forEach(val => params.push(val)); // Push each value onto params array
                    conditions.push(`${fieldExpr} ${operator} (${placeholders})`);
                }
                break;
            case 'LIKE':
            case 'NOT LIKE':
                if (typeof value !== 'string') {
                    console.warn(`Value for ${operator} operator on field ${filter.field.name} must be a string. Condition ignored.`);
                } else {
                    params.push(value);
                    conditions.push(`${fieldExpr} ${operator} ?`);
                }
                break;
            case 'IS NULL':
                conditions.push(`${fieldExpr} IS NULL`);
                break;
            case 'IS NOT NULL':
                conditions.push(`${fieldExpr} IS NOT NULL`);
                break;
            default:
                console.warn(`Unsupported filter operator used: ${operator}. Condition ignored.`);
                break;
        }
    });

    // Return joined conditions or null if none were valid
    return conditions.length > 0 ? conditions.join(' AND ') : null;
}


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
    eventsTable: string = 'events',
    startDate: Date | string,
    endDate: Date | string
): { sql: string; params: QueryParamValue[] } { // Updated return type
    if (!steps || steps.length === 0) {
        return {
            sql: '',
            params: [],
        }
    }

    const params: QueryParamValue[] = []; // Initialize parameter array
    const ctes: string[] = [];
    const stepCompletionAliases: string[] = [];

    // --- Base Events CTE with Time Filter ---
    const timeFilterClause = buildTimeFilterClause(startDate, endDate, params, '"timestamp"'); // Pass params
    const baseCteName = "Base_Events";
    const baseCteSql = `
    ${baseCteName} AS (
      SELECT * -- Select all columns needed downstream
      FROM "${eventsTable}"
      ${timeFilterClause ? `WHERE ${timeFilterClause}` : '-- No time filter applied'}
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
        const prevCteName = isFirstStep ? '' : `Step${index}_Completion`;
        const prevStepAlias = isFirstStep ? '' : `s${index}`;
        const prevStepTimeAlias = isFirstStep ? '' : `step${index}_time`;
        const tableAlias = isFirstStep ? null : 'e';
        const sourceTable = isFirstStep ? baseCteName : `${baseCteName} ${tableAlias}`;

        // --- SELECT Clause (Summary Version) ---
        const selectClause = `
      SELECT
          ${tableAlias ? `${tableAlias}.` : ''}"distinct_id",
          MIN(${tableAlias ? `${tableAlias}.` : ''}"timestamp") AS ${stepTimeAlias}
    `;

        // --- FROM Clause ---
        const fromClause = isFirstStep
            ? `FROM ${sourceTable}`
            : `FROM ${sourceTable} JOIN ${prevCteName} ${prevStepAlias} ON ${tableAlias}."distinct_id" = ${prevStepAlias}."distinct_id"`;

        // --- WHERE Clause ---
        const whereConditions: string[] = [];
        if (!isFirstStep) {
            whereConditions.push(`${tableAlias}."timestamp" > ${prevStepAlias}.${prevStepTimeAlias}`);
        }
        // Build parameterized WHERE clause for step filters
        const stepWhereClause = buildWhereClause(step.query.filters, params, 'properties', tableAlias); // Pass params
        if (stepWhereClause) { // Add if not null
            whereConditions.push(stepWhereClause);
        }
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // --- GROUP BY Clause ---
        const groupByClause = `GROUP BY ${tableAlias ? `${tableAlias}.` : ''}"distinct_id"`;

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
    let finalSelect = 'SELECT\n';
    let finalFrom = `FROM Step1_Completion ${stepCompletionAliases[0]}\n`;

    steps.forEach((step, index) => {
        const currentAlias = stepCompletionAliases[index];
        // Use step name in alias, escape if necessary (basic escaping here)
        const safeAlias = step.name.replace(/[^a-zA-Z0-9_]/g, '_');
        finalSelect += `    COUNT(${currentAlias}."distinct_id") AS "${safeAlias}_count"`; // Use safe alias

        if (index < steps.length - 1) {
            finalSelect += ',\n';
        } else {
            finalSelect += '\n';
        }

        if (index < steps.length - 1) {
            const nextStepNum = index + 2;
            const nextAlias = stepCompletionAliases[index + 1];
            finalFrom += `LEFT JOIN Step${nextStepNum}_Completion ${nextAlias} ON ${currentAlias}."distinct_id" = ${nextAlias}."distinct_id"\n`;
        }
    });

    // --- Assemble the Full Query ---
    const fullQuery = `
    WITH ${ctes.join(',\n\n')}

    ${finalSelect}
    ${finalFrom};
  `;

    // Return the SQL string and the populated parameters array
    return { sql: fullQuery.trim(), params: params };
}
