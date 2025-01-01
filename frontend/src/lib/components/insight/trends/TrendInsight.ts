import type {
    Insight,
    InsightType,
    TimeBucket,
} from '$lib/components/insight/Insight'
import type { InsightMeta } from '$lib/components/insight/meta/InsightMeta'
import { dbManager } from '$lib/globals'
import type { Field, FieldFilter } from '$lib/queries/field'
import { type OrderBy, buildQuery } from '$lib/queries/queries'

export interface TrendInsight extends Insight {
    type: 'Trend'
    series?: TrendSeries[]
}

const groupBy = (timeBucket: TimeBucket): string => {
    const dateTruncate =
        timeBucket === 'Daily'
            ? 'day'
            : timeBucket === 'Weekly'
              ? 'week'
              : 'month'
    return `date_trunc('${dateTruncate}', timestamp)`
}

export const fetchData = async (
    insight: TrendInsight,
    meta: InsightMeta,
): Promise<ResultType[][]> => {
    const results: ResultType[][] = []
    for (let series of insight.series ?? []) {
        series = applySeriesDefaults(series)
        const aggregation = series.query?.aggregations?.[0]
        console.log(aggregation)
        const { sql, params } = buildQuery({
            aggregations: series.query?.aggregations,
            filters: [
                ...(series.query?.filters ?? []),
                {
                    field: { name: 'timestamp', type: 'number' },
                    operator: '>=',
                    value: meta.range.start.toISOString(),
                },
                {
                    field: { name: 'timestamp', type: 'number' },
                    operator: '<=',
                    value: meta.range.end.toISOString(),
                },
            ],
            groupBy: [{ name: groupBy(meta.timeBucket), type: 'string' }],
            orderBy: [
                {
                    direction: 'ASC',
                    field: {
                        name: 'bucket_0',
                        type: 'number',
                    },
                },
            ],
        })
        console.log(sql, params)
        results.push(await dbManager.runQuery(sql, params))
    }
    return results
}

const applySeriesDefaults = (series: TrendSeries): TrendSeries => {
    return {
        ...trendSeriesDefaults,
        ...series,
    }
}

interface ResultType {
    bucket_0: string
    result_value: bigint
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
