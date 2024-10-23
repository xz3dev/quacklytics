import { buildQuery, type Field, type FieldFilter } from '$lib/local-queries'
import { Insight, type InsightType } from '$lib/components/insight/Insight'
import moment from 'moment'
import { dbManager } from '$lib/globals'

type TimeBucket = 'Daily' | 'Weekly' | 'Monthly'

export class TrendInsight extends Insight {
    type: InsightType = 'Trend'
    series: TrendSeries[] = []
    timeBucket: TimeBucket = 'Daily'
    duration: moment.Duration = moment.duration(12, 'weeks')

    private groupBy(timeBucket: TimeBucket): string {
        const dateTruncate = this.timeBucket === 'Daily'
            ? 'day'
            : this.timeBucket === 'Weekly'
                ? 'week'
                : 'month'
        return `date_trunc('${dateTruncate}', timestamp)`
    }

    async fetchData(): Promise<ResultType[][]> {
        const results: ResultType[][] = []
        for (const series of this.series) {
            const { sql, params } = buildQuery({
                aggregations: series.aggregations,
                filters: series.filters,
                groupBy: [{ name: this.groupBy(this.timeBucket) }],
            })
            console.log('params', params)
            console.log('sql', sql)
            results.push(await dbManager.runQuery(sql, params))
        }
        return results
    }
}

interface ResultType {
    bucket_0: string
    result_value: BigInt
}

export interface TrendSeries {
    name: string
    aggregations: TrendAggregation[]
    filters: FieldFilter[]
}

export type TrendAggregationFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';

export interface TrendAggregation {
    function: TrendAggregationFunction
    field: Field
    alias: 'result_value'
}
