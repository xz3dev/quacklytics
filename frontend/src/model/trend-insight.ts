import {Insight} from "@/model/insight.ts";
import {Field} from "@/model/filters.ts";
import {determineDateRange} from "@/model/InsightDateRange.ts";
import {Duration, intervalToDuration} from "date-fns";
import {Query} from "@/lib/queries";

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
    query?: Query
}


export const newTrendInsight: Omit<TrendInsight, 'id'> = {
    type: 'Trend',
    series: [
        {
            name: 'default',
            visualisation: 'line',
            query: {
                filters: [],
                aggregations: [{
                    function: 'COUNT',
                    alias: 'result_value',
                    field: {
                        name: 'id',
                        type: 'string',
                    }
                }],
            }
        }
    ],
    config: {
        duration: 'P4W',
        timeBucket: 'Daily'
    },
    favorite: false,
}

export const trendAggregationFunctions = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] as const
export type TrendAggregationFunction = (typeof trendAggregationFunctions)[number]

export interface TrendAggregation {
    function: TrendAggregationFunction
    field: Field
    alias: 'result_value'
    distinct?: boolean
}

export const requireMinDays = (minDays: number): ((range: string) => boolean) => {
    return (range: string) => {
        const dateRange = determineDateRange(range)
        const duration = intervalToDuration({start: dateRange.start, end: dateRange.end})
        return (duration?.days ?? 0) >= minDays
    }
}

export const requireMaxDays = (maxDays: number): ((range: string) => boolean) => {
    return (range: string) => {
        const dateRange = determineDateRange(range)
        const duration = intervalToDuration({start: dateRange.start, end: dateRange.end})
        return (duration?.days ?? 0) <= maxDays
    }
}


export const timeBuckets = ['Hourly', 'Daily', 'Weekly', 'Monthly'] as const;
export type TimeBucket = (typeof timeBuckets)[number];
export const timeBucketData: {
    [key in TimeBucket]: TimeBucketData;
} = {
    Hourly: {
        label: 'Hour',
        canActivate: requireMaxDays(2),
        interval: {
            hours: 1,
        },
    },
    Daily: {
        label: 'Day',
        canActivate: requireMinDays(2),
        interval: {
            days: 1,
        },
    },
    Weekly: {
        label: 'Week',
        canActivate: requireMinDays(2),
        interval: {
            weeks: 1,
        },
    },
    Monthly: {
        label: 'Month',
        canActivate: requireMinDays(2),
        interval: {
            months: 1,
        },
    },
};

interface TimeBucketData {
    label: string
    canActivate: (dateRange: string) => boolean
    interval: Duration
}
