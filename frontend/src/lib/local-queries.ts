// Define supported SQL operators
export const operators = ['=', '>', '<', '>=', '<=', '<>', 'LIKE', 'IN'] as const
export type Operator = typeof operators[number];

export const aggregationFunctions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] as const
export type AggregationFunction = typeof aggregationFunctions[number];
export type SortDirection = 'ASC' | 'DESC';

// Interface for a field in a query, with support for JSON properties
export interface Field {
    name: string;                // Field name or JSON path
}

// Interface for a filter condition
export interface FieldFilter {
    field: Field;
    operator: Operator;
    value: any;
}

// Interface for an aggregation function
export interface Aggregation {
    function: AggregationFunction;
    field: Field;
    alias?: string;
}

// Interface for ordering results
export interface OrderBy {
    field: Field;
    direction: SortDirection;
}

// Main query interface
export interface Query {
    select?: Field[];
    filters?: FieldFilter[];
    groupBy?: Field[];
    orderBy?: OrderBy[];
    aggregations?: Aggregation[];
    limit?: number;
    offset?: number;
}

// Function to generate the SQL expression for a field
function getFieldExpression(field: Field, castType?: string): string {
    let expression = ''
    const isJsonField = field.name.startsWith('$.')
    console.log(field.name, isJsonField)
    const nameCleaned = field.name.replace(/\$\./g, '')
    if (isJsonField) {
        const jsonPath = `$.${nameCleaned}`
        expression = `CAST(json_extract(properties, '${jsonPath}') AS ${castType ?? 'VARCHAR'})`
    } else {
        if(castType) {
            expression = `CAST(${expression} AS ${castType})`
        } else {
            expression = field.name
        }
    }

    return expression
}

// Function to build the SQL query and parameters from a Query object
export function buildQuery(query: Query): { sql: string; params: any[] } {
    const params: any[] = []
    let sql = 'SELECT '
    const selectParts: string[] = []

    // Construct SELECT clause
    if (query.aggregations && query.aggregations.length > 0) {
        for (const agg of query.aggregations) {
            const castType = agg.function === 'COUNT' ? undefined : 'FLOAT'
            const fieldExpr = getFieldExpression(agg.field, castType)
            const aggExpr = `${agg.function}(${fieldExpr})${agg.alias ? ` AS ${agg.alias}` : ''}`
            selectParts.push(aggExpr)
        }
    }

    if (query.select && query.select.length > 0) {
        for (const field of query.select) {
            const fieldExpr = getFieldExpression(field)
            selectParts.push(fieldExpr)
        }
    }


    // Add group by as alias to select
    if (query.groupBy && query.groupBy.length > 0) {
        const groupByParts = query.groupBy
            .map((field, index) => `${getFieldExpression(field)} as bucket_${index}`)
        selectParts.push(...groupByParts)
    }

    if (selectParts.length === 0) {
        selectParts.push('*')
    }

    sql += selectParts.join(', ')
    sql += ' FROM events'

    // Construct WHERE clause
    if (query.filters && query.filters.length > 0) {
        const whereClauses: string[] = []

        for (const filter of query.filters) {
            const fieldExpr = getFieldExpression(filter.field)
            whereClauses.push(`${fieldExpr} ${filter.operator} ?`)
            params.push(filter.value)
        }

        sql += ' WHERE ' + whereClauses.join(' AND ')
    }

    // Construct GROUP BY clause
    if (query.groupBy && query.groupBy.length > 0) {
        const groupByParts = query.groupBy
            .map((field, index) => `bucket_${index}`)
        sql += ' GROUP BY ' + groupByParts.join(', ')
    }

    // Construct ORDER BY clause
    if (query.orderBy && query.orderBy.length > 0) {
        const orderByParts = query.orderBy.map((order) => {
            const fieldExpr = getFieldExpression(order.field)
            return `${fieldExpr} ${order.direction}`
        })
        sql += ' ORDER BY ' + orderByParts.join(', ')
    }

    // Add LIMIT and OFFSET if specified
    if (query.limit !== undefined) {
        sql += ' LIMIT ' + query.limit
    }

    if (query.offset !== undefined) {
        sql += ' OFFSET ' + query.offset
    }

    return { sql, params }
}
