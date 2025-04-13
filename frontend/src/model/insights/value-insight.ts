import {Insight, InsightConfig} from "@/model/insights/insight.ts";
import {Query} from "@lib/trend-queries.ts";

export interface ValueInsight extends Insight {
    type: 'Value'
    config: InsightConfig & {
        value: ValueInsightConfig
    }
}

export interface ValueInsightConfig {
    duration: string
    series: ValueSeries
}

export interface ValueSeries {
    query: Query
}

export const newValueInsight: Omit<ValueInsight, 'id'> = {
    type: 'Value',
    config: {
        value: {
            duration: 'P30D',
            series: {
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
        }
    },
    favorite: false,
}
