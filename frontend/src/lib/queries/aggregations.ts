import type { Field } from '$lib/queries/field'

export const aggregationFunctions = [
    'COUNT',
    'SUM',
    'AVG',
    'MIN',
    'MAX',
] as const

export type AggregationFunction = (typeof aggregationFunctions)[number]
export const isNumericAggregation = (agg: AggregationFunction) =>
    agg !== 'COUNT'

// Interface for an aggregation function
export interface Aggregation {
    function: AggregationFunction
    field: Field
    alias?: string
    distinct?: boolean
}
