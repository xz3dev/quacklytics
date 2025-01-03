import {Field} from "@/model/filters.ts";

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


export type ExtractAliases<T extends Aggregation[]> = {
    [K in keyof T]: T[K] extends { alias: string }
        ? T[K]['alias']
        : T[K]['field']['name']
}[number]

// Result type for a query with aggregations
export type AggregationResult<T extends Aggregation[]> = {
    [K in ExtractAliases<T>]: string
}[]
