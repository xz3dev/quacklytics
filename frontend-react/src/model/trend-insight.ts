import {Insight} from "@/model/insight.ts";
import {Field, FieldFilter} from "@/model/filters.ts";

export interface TrendInsight extends Insight {
    type: 'Trend'
    series?: TrendSeries[]
    config: TrendInsightConfig
}

export interface TrendInsightConfig {
    timeBucket: TimeBucket
    duration: string
}

export const trendSeriesTypes = ['line', 'bar'] as const
export type TrendSeriesType = (typeof trendSeriesTypes)[number]

export interface TrendSeries {
    visualisation: TrendSeriesType
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

export const timeBuckets = ['Daily', 'Weekly', 'Monthly'] as const;
export type TimeBucket = (typeof timeBuckets)[number];
export const timeBucketLabels: {
    [key in TimeBucket]: string;
} = {
    Daily: 'Day',
    Weekly: 'Week',
    Monthly: 'Month',
};
