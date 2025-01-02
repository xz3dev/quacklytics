import { Field, FieldFilter } from "@/model/filters"
import {Aggregation} from "@lib/aggregations.ts";
import {getFieldExpression} from "@lib/field.ts";

export type SortDirection = 'ASC' | 'DESC'

export type QueryParamValue =
    | string
    | number
    | boolean
    | Date
    | null
    | undefined

// Interface for ordering results
export interface OrderBy {
    field: Field
    direction: SortDirection
}

// Main query interface
export interface Query {
    select?: Field[]
    filters?: FieldFilter[]
    groupBy?: Field[]
    orderBy?: OrderBy[]
    aggregations?: Aggregation[]
    limit?: number
    offset?: number
}

// Function to build the SQL query and parameters from a Query object
export function buildQuery(query: Query): {
    sql: string
    params: QueryParamValue[]
} {
    const params: QueryParamValue[] = []
    let sql = 'SELECT '
    const selectParts: string[] = []

    // Construct SELECT clause
    if (query.aggregations && query.aggregations.length > 0) {
        for (const agg of query.aggregations) {
            const castType = agg.function === 'COUNT' ? undefined : 'FLOAT'
            const fieldExpr = getFieldExpression(agg.field, castType)
            const optionalDistinct = agg.distinct ? 'distinct ' : ''
            const aggExpr = `${agg.function}(${optionalDistinct}${fieldExpr})${agg.alias ? ` AS ${agg.alias}` : ''}`
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
        const groupByParts = query.groupBy.map(
            (field, index) => `${getFieldExpression(field)} as bucket_${index}`,
        )
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

        sql += ` WHERE ${whereClauses.join(' AND ')}`
    }

    // Construct GROUP BY clause
    if (query.groupBy && query.groupBy.length > 0) {
        const groupByParts = query.groupBy.map(
            (_, index) => `bucket_${index}`,
        )
        sql += ` GROUP BY ${groupByParts.join(', ')}`
    }

    // Construct ORDER BY clause
    if (query.orderBy && query.orderBy.length > 0) {
        const orderByParts = query.orderBy.map((order) => {
            const fieldExpr = getFieldExpression(order.field)
            return `${fieldExpr} ${order.direction}`
        })
        sql += ` ORDER BY ${orderByParts.join(', ')}`
    }

    // Add LIMIT and OFFSET if specified
    if (query.limit !== undefined) {
        sql += ` LIMIT ${query.limit}`
    }

    if (query.offset !== undefined) {
        sql += ` OFFSET ${query.offset}`
    }

    return { sql, params }
}
