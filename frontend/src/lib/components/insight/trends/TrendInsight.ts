import { buildQuery, type Field, type FieldFilter } from '$lib/local-queries'
import { Insight, type InsightType, type TimeBucket } from '$lib/components/insight/Insight'
import { dbManager } from '$lib/globals'
import type { InsightMeta } from '$lib/components/insight/InsightMeta'

export class TrendInsight extends Insight {
    type: InsightType = 'Trend'
    series: TrendSeries[] = []

    private groupBy(timeBucket: TimeBucket): string {
        const dateTruncate = timeBucket === 'Daily'
            ? 'day'
            : timeBucket === 'Weekly'
                ? 'week'
                : 'month'
        return `date_trunc('${dateTruncate}', timestamp)`
    }

    async fetchData(meta: InsightMeta): Promise<ResultType[][]> {
        const results: ResultType[][] = []
        for (const series of this.series) {
            const { sql, params } = buildQuery({
                aggregations: series.aggregations,
                filters: [
                    ...series.filters,
                    { field: { name: 'timestamp' }, operator: '>=', value: meta.range.start.toISOString() },
                    { field: { name: 'timestamp' }, operator: '<=', value: meta.range.end.toISOString() },
                ],
                groupBy: [{ name: this.groupBy(meta.timeBucket) }],
            })
            console.log(sql, params)
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
