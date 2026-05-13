import {Insight, InsightConfig} from "@/model/insights/insight.ts";
import {Field, FieldFilter} from "@/model/filters.ts";
import {Aggregation} from "@lib/aggregations.ts";

export interface BreakdownInsight extends Insight {
    type: 'Breakdown'
    config: InsightConfig & {
        breakdown: BreakdownInsightConfig
    }
}

export interface BreakdownInsightConfig {
    duration: string
    dimension: Field
    aggregation: Aggregation
    filters?: FieldFilter[]
    limit?: number
}

export const newBreakdownInsight: Omit<BreakdownInsight, 'id'> = {
    type: 'Breakdown',
    config: {
        breakdown: {
            duration: 'P30D',
            dimension: {
                name: 'event_type',
                type: 'string',
            },
            aggregation: {
                function: 'COUNT',
                alias: 'result_value',
                field: {
                    name: 'id',
                    type: 'string',
                },
            },
            filters: [],
            limit: 10,
        },
    },
    favorite: false,
}
