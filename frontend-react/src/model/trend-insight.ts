import {Insight} from "@/model/insight.ts";
import {Field, FieldFilter} from "@/model/filters.ts";


export interface TrendInsight extends Insight {
    type: 'Trend'
    series?: TrendSeries[]
}

export const trendSeriesTypes = ['line', 'bar'] as const
export type TrendSeriesType = (typeof trendSeriesTypes)[number]

export interface TrendSeries {
    visualisation: 'line' | 'bar'
    name: string
    query?: {
        aggregations: TrendAggregation[]
        filters: FieldFilter[]
    }
}

export const trendSeriesDefaults: TrendSeries = {
    visualisation: 'line',
    name: '',
    query: {
        aggregations: [],
        filters: [],
    },
}

export type TrendAggregationFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'

export interface TrendAggregation {
    function: TrendAggregationFunction
    field: Field
    alias: 'result_value'
    distinct?: boolean
}
