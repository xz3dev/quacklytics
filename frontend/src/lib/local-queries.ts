export type Timeframe = 'Hourly' | 'Daily' | 'Weekly' | 'Monthly';

export type AggregationFunction =
    | 'Count'
    | 'Sum'
    | 'Average'
    | 'Min'
    | 'Max'
    | 'CountDistinct';

export interface Aggregation {
    function: AggregationFunction;
    field?: string; // Field or property on which the aggregation is performed
}

export interface FilterCondition {
    field: string;
    operator: '=' | '!=' | '<' | '<=' | '>' | '>=' | 'IN' | 'NOT IN' | 'LIKE';
    value: any;
}

export interface QueryParameters {
    eventType?: string;
    timeframe: Timeframe;
    aggregations: Aggregation[];
    filters?: FilterCondition[];
    groupBy?: string[]; // Fields to group by
    orderBy?: string; // Field to order by
    startDate?: string;
    endDate?: string;
}


export function buildQuery(params: QueryParameters): string {
    const {
        timeframe,
        aggregations,
        filters,
        groupBy,
        orderBy,
        eventType,
        startDate,
        endDate,
    } = params


    const selectClause = buildSelectClause(aggregations, timeframe)
    const fromClause = `FROM events`
    const whereClause = buildWhereClause(eventType, startDate, endDate, filters)
    const groupByClause = buildGroupByClause(groupBy, timeframe)
    const orderByClause = buildOrderByClause(orderBy)

    const query = `
    SELECT
      ${selectClause}
    ${fromClause}
    ${whereClause}
    ${groupByClause}
    ${orderByClause}
  `
    return query.trim()
}


function buildSelectClause(aggregations: Aggregation[], timeframe: Timeframe): string {
    const timeframeExpression = getTimeframeExpression(timeframe);
    const aggregationExpressions = aggregations.map(agg => getAggregationExpression(agg));

    return [timeframeExpression, ...aggregationExpressions].join(', ');
}

function getTimeframeExpression(timeframe: Timeframe): string {
    const timeframeTrunc = {
        'Hourly': "date_trunc('hour', timestamp) AS time_bucket",
        'Daily': "date_trunc('day', timestamp) AS time_bucket",
        'Weekly': "date_trunc('week', timestamp) AS time_bucket",
        'Monthly': "date_trunc('month', timestamp) AS time_bucket",
    };

    return timeframeTrunc[timeframe];
}

function getAggregationExpression(agg: Aggregation): string {
    const { function: func, field } = agg;
    const targetField = field ? getFieldExpression(field) : '*';

    const aggregationFunctions = {
        'Count': `COUNT(${targetField}) AS count`,
        'Sum': `SUM(${targetField}) AS sum`,
        'Average': `AVG(${targetField}) AS average`,
        'Min': `MIN(${targetField}) AS min`,
        'Max': `MAX(${targetField}) AS max`,
        'CountDistinct': `COUNT(DISTINCT ${targetField}) AS count_distinct`,
    };

    if (!aggregationFunctions[func]) {
        throw new Error(`Unsupported aggregation function: ${func}`);
    }

    return aggregationFunctions[func];
}

function getFieldExpression(field: string): string {
    // Check if the field is in the properties object
    if (field.startsWith('properties.')) {
        const propertyKey = field.replace('properties.', '');
        return `CAST(properties->>'${propertyKey}' AS FLOAT)`;
    } else {
        return field;
    }
}

function buildWhereClause(
    eventType?: string,
    startDate?: string,
    endDate?: string,
    filters?: FilterCondition[],
): string {
    const conditions = ['1=1'];

    if (eventType) {
        conditions.push(`event_type = '${escapeValue(eventType)}'`);
    }

    if (startDate) {
        conditions.push(`timestamp >= '${escapeValue(startDate)}'`);
    }

    if (endDate) {
        conditions.push(`timestamp <= '${escapeValue(endDate)}'`);
    }

    if (filters) {
        filters.forEach(filter => {
            const { field, operator, value } = filter;
            const fieldExpression = getFieldExpression(field);
            const valueExpression = formatValue(value);
            conditions.push(`${fieldExpression} ${operator} ${valueExpression}`);
        });
    }

    return `WHERE ${conditions.join(' AND ')}`;
}

function buildGroupByClause(groupBy?: string[], timeframe?: Timeframe): string {
    const groupings = ['time_bucket']; // Always group by time bucket

    if (groupBy) {
        groupBy.forEach(field => {
            const fieldExpression = getFieldExpression(field);
            groupings.push(fieldExpression);
        });
    }

    return `GROUP BY ${groupings.join(', ')}`;
}

function buildOrderByClause(orderBy?: string): string {
    if (orderBy) {
        const fieldExpression = getFieldExpression(orderBy);
        return `ORDER BY ${fieldExpression}`;
    } else {
        return `ORDER BY time_bucket`;
    }
}

function formatValue(value: any): string {
    if (typeof value === 'string') {
        return `'${escapeValue(value)}'`;
    } else if (Array.isArray(value)) {
        const formattedValues = value.map(v => formatValue(v)).join(', ');
        return `(${formattedValues})`;
    } else {
        return value.toString();
    }
}

function escapeValue(value: string): string {
    // Basic escaping to prevent SQL injection
    return value.replace(/'/g, "''");
}
