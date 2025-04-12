import {QueryParamValue} from "@lib/queries.ts";
import {FieldFilter} from "@/model/filters.ts"; // Assumes FieldFilter has { field: { name: string }, ... } structure now
import {FunnelStep} from "@/model/insights/funnel-insights.ts";

// --- Constants for SQL Conditions ---
const ALWAYS_TRUE = '1=1';
const ALWAYS_FALSE = '1=0';

// Helper function to safely escape single quotes in SQL strings
function escapeSqlString(value: string): string {
    if (typeof value !== 'string') return value;
    return value.replace(/'/g, "''");
}

// Helper function to format various JavaScript values into SQL literal representation
function formatSqlValue(value: QueryParamValue): string {
    if (value === null || value === undefined) {
        return 'NULL';
    }
    if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(value)) {
            return `'${escapeSqlString(value)}'`;
        }
        return `'${escapeSqlString(value)}'`;
    }
    if (typeof value === 'boolean') {
        return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'number') {
        return value.toString();
    }
    if (value instanceof Date) {
        return `'${value.toISOString()}'`;
    }
    console.warn('Unsupported value type encountered in formatSqlValue:', value);
    return `'${escapeSqlString(String(value))}'`;
}


/**
 * Builds a SQL WHERE clause string from an array of FieldFilter objects.
 * Handles basic JSON property access assuming 'properties.' prefix maps to DuckDB JSON path.
 * Uses actual schema column names: "event_type", "properties".
 * Assumes filter.field is an object with a 'name' property.
 * Uses constants ALWAYS_TRUE and ALWAYS_FALSE for clarity.
 * @param filters - Array of filter conditions.
 * @param jsonColumn - Name of the JSON column in the table (defaults to 'properties').
 * @param tableAlias - Optional alias for the table (e.g., 'e') to prefix column names.
 * @returns A SQL WHERE clause string (e.g., "event_type" = 'value' AND "properties" ->> '$.prop' > 10) or value of ALWAYS_TRUE if no filters.
 */
function buildWhereClause(
    filters: FieldFilter[] | undefined,
    jsonColumn: string = 'properties', // Keep default as 'properties' for correct schema
    tableAlias: string | null = null
): string {
    if (!filters || filters.length === 0) {
        return ALWAYS_TRUE; // Use constant
    }

    const prefix = tableAlias ? `${tableAlias}.` : '';

    const conditions = filters.map(filter => {
        // Use filter.field.name based on user's provided code structure
        const fieldName = filter.field.name as string; // Assuming field is { name: string }
        const operator = (filter.operator as string).toUpperCase();
        const value = filter.value;

        let sqlField = '';
        // Check if the field refers to a JSON property
        if (fieldName.startsWith('properties.')) {
            const jsonPath = fieldName.substring('properties.'.length);
            // Use correct jsonColumn ('properties')
            sqlField = `${prefix}"${jsonColumn}" ->> '$.${jsonPath}'`;
        } else {
            // Assume standard column, quote the name
            sqlField = `${prefix}"${fieldName}"`;
        }

        // Handle different SQL operators (Logic remains the same)
        switch (operator) {
            case '=':
            case '!=':
            case '<>':
                if (value === null || value === undefined) {
                    return `${sqlField} ${operator === '=' ? 'IS NULL' : 'IS NOT NULL'}`;
                }
                return `${sqlField} ${operator === '<>' ? '!=' : operator} ${formatSqlValue(value)}`;
            case '>':
            case '<':
            case '>=':
            case '<=':
                if (value === null || value === undefined) {
                    console.warn(`Attempting comparison (${operator}) with NULL for field ${fieldName}.`);
                    return ALWAYS_FALSE; // Use constant
                }
                return `${sqlField} ${operator} ${formatSqlValue(value)}`;
            case 'IN':
            case 'NOT IN':
                if (!Array.isArray(value)) {
                    console.warn(`Value for ${operator} operator on field ${fieldName} is not an array.`);
                    // Use constants
                    return operator === 'IN' ? ALWAYS_FALSE : ALWAYS_TRUE;
                }
                if (value.length === 0) {
                    // Use constants
                    return operator === 'IN' ? ALWAYS_FALSE : ALWAYS_TRUE;
                }
                const formattedValues = value.map(formatSqlValue).join(', ');
                return `${sqlField} ${operator} (${formattedValues})`;
            case 'LIKE':
            case 'NOT LIKE':
                if (typeof value !== 'string') {
                    console.warn(`Value for ${operator} operator on field ${fieldName} must be a string.`);
                    // Use constants
                    return operator === 'LIKE' ? ALWAYS_FALSE : ALWAYS_TRUE;
                }
                return `${sqlField} ${operator} ${formatSqlValue(value)}`;
            case 'IS NULL':
                return `${sqlField} IS NULL`;
            case 'IS NOT NULL':
                return `${sqlField} IS NOT NULL`;
            default:
                console.warn(`Unsupported filter operator used: ${operator}`);
                return ALWAYS_TRUE; // Use constant
        }
    });

    // Filter out any conditions that might have resulted in empty strings (though current logic avoids this)
    const validConditions = conditions.filter(c => c && c.length > 0);

    // If after filtering, there are no valid conditions (e.g., all filters were invalid), return ALWAYS_TRUE
    if (validConditions.length === 0) {
        return ALWAYS_TRUE;
    }

    return validConditions.join(' AND ');
}


/**
 * Builds a DuckDB SQL query string to calculate the trend of users completing a funnel sequentially.
 * Uses actual schema column names: "timestamp", "event_type", "distinct_id", "properties".
 *
 * @param steps - An array of FunnelStep objects defining the funnel.
 * @param timeGranularity - The time bucket for the trend ('day', 'week', 'month'). Defaults to 'day'.
 * @param eventsTable - The name of the events table in DuckDB. Defaults to 'events'.
 * @returns A string containing the complete DuckDB SQL query.
 */
export function buildFunnelTrendQuery(
    steps: FunnelStep[],
    timeGranularity: 'day' | 'week' | 'month' = 'day',
    eventsTable: string = 'events'
): string {
    if (!steps || steps.length === 0) {
        throw new Error("Funnel definition must include at least one step.");
    }

    const ctes: string[] = [];
    const finalUnionParts: string[] = [];

    steps.forEach((step, index) => {
        const stepNum = index + 1;
        const cteName = `Step${stepNum}_Completion`;
        const stepTimeAlias = `step${stepNum}_time`;
        const stepDateAlias = `step${stepNum}_date`;

        const isFirstStep = index === 0;
        const prevCteName = isFirstStep ? '' : `Step${index}_Completion`;
        const prevStepAlias = isFirstStep ? '' : `s${index}`;
        const prevStepTimeAlias = isFirstStep ? '' : `step${index}_time`;
        const tableAlias = isFirstStep ? null : 'e';

        // --- SELECT Clause ---
        // Ensure correct column names "distinct_id" and "timestamp" are used
        const selectClause = `
      SELECT
          ${tableAlias ? `${tableAlias}.` : ''}"distinct_id",
          MIN(${tableAlias ? `${tableAlias}.` : ''}"timestamp") AS ${stepTimeAlias},
          DATE_TRUNC('${timeGranularity}', MIN(${tableAlias ? `${tableAlias}.` : ''}"timestamp")) AS ${stepDateAlias} -- Corrected: Use timestamp
    `;

        // --- FROM Clause ---
        // Ensure correct column name "distinct_id" is used in JOIN
        const fromClause = isFirstStep
            ? `FROM "${eventsTable}"`
            : `FROM "${eventsTable}" ${tableAlias} JOIN ${prevCteName} ${prevStepAlias} ON ${tableAlias}."distinct_id" = ${prevStepAlias}."distinct_id"`;

        // --- WHERE Clause ---
        const whereConditions: string[] = [];
        // Ensure correct column name "timestamp" is used for time comparison
        if (!isFirstStep) {
            whereConditions.push(`${tableAlias}."timestamp" > ${prevStepAlias}.${prevStepTimeAlias}`); // Corrected: Use timestamp
        }
        // Ensure correct jsonColumn 'properties' is passed to buildWhereClause
        const stepWhereClause = buildWhereClause(step.query.filters, 'properties', tableAlias); // Corrected: Use 'properties'
        // Only add the clause if it's not effectively empty (i.e., not just ALWAYS_TRUE)
        if (stepWhereClause && stepWhereClause !== ALWAYS_TRUE) {
            whereConditions.push(stepWhereClause);
        }
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        // --- GROUP BY Clause ---
        // Ensure correct column name "distinct_id" is used
        const groupByClause = `GROUP BY ${tableAlias ? `${tableAlias}.` : ''}"distinct_id"`;

        // Assemble the CTE definition string
        const cteSql = `${cteName} AS (
      ${selectClause}
      ${fromClause}
      ${whereClause}
      ${groupByClause}
    )`;
        ctes.push(cteSql);

        // --- Final UNION ALL Part ---
        // Ensure correct column name "distinct_id" is used in COUNT
        finalUnionParts.push(`
      SELECT
          ${stepDateAlias} AS event_date,
          '${escapeSqlString(step.name)}' AS step_name,
          COUNT(DISTINCT "distinct_id") AS distinct_users
      FROM ${cteName}
      GROUP BY 1, 2
    `);
    });

    // --- Assemble the Full Query ---
    const fullQuery = `
    -- Funnel Trend Analysis Query Generated by buildFunnelTrendQuery (Updated Schema + Merged Changes + Constants)
    WITH ${ctes.join(',\n\n')}

    -- Combine results for each step over time
    ${finalUnionParts.join('\nUNION ALL\n')}

    -- Order results chronologically and by step name for clarity
    ORDER BY event_date ASC, step_name ASC;
  `;

    return fullQuery.trim();
}
