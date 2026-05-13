import {Insight, InsightConfig} from "@/model/insights/insight.ts";
import {Query} from "@lib/trend-queries.ts";
import {TimeBucket} from "@/model/insights/trend-insight.ts";

export interface RetentionInsight extends Insight {
    type: 'Retention'
    config: InsightConfig & {
        retention: RetentionInsightConfig
    }
}

export interface RetentionInsightConfig {
    duration: string
    cohortBucket: TimeBucket
    activationQuery: Query
    returnQuery: Query
    maxPeriods?: number
}

export const newRetentionInsight: Omit<RetentionInsight, 'id'> = {
    type: 'Retention',
    config: {
        retention: {
            duration: 'P30D',
            cohortBucket: 'Daily',
            activationQuery: {
                filters: [],
            },
            returnQuery: {
                filters: [],
            },
            maxPeriods: 14,
        },
    },
    favorite: false,
}
