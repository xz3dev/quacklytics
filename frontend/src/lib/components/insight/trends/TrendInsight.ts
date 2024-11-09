import { buildQuery, type Field, type FieldFilter } from '$lib/local-queries';
import { type Insight, type InsightType, type TimeBucket } from '$lib/components/insight/Insight';
import { dbManager } from '$lib/globals';
import type { InsightMeta } from '$lib/components/insight/meta/InsightMeta';

export interface TrendInsight extends Insight {
  type: 'Trend';
  series?: TrendSeries[];
}

const groupBy = (timeBucket: TimeBucket): string => {
  const dateTruncate = timeBucket === 'Daily' ? 'day' : timeBucket === 'Weekly' ? 'week' : 'month';
  return `date_trunc('${dateTruncate}', timestamp)`;
};

export const fetchData = async (
  insight: TrendInsight,
  meta: InsightMeta,
): Promise<ResultType[][]> => {
  const results: ResultType[][] = [];
  for (const series of insight.series ?? []) {
    const { sql, params } = buildQuery({
      aggregations: series.query.aggregations,
      filters: [
        ...series.query.filters,
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
    });
    console.log(sql, params);
    results.push(await dbManager.runQuery(sql, params));
  }
  return results;
};

interface ResultType {
  bucket_0: string;
  result_value: BigInt;
}

export interface TrendSeries {
  name: string;
  query: {
    aggregations: TrendAggregation[];
    filters: FieldFilter[];
  };
}

export type TrendAggregationFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';

export interface TrendAggregation {
  function: TrendAggregationFunction;
  field: Field;
  alias: 'result_value';
}
