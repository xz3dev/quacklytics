import {Insight, InsightConfig} from "@/model/insights/insight.ts";
import {Query} from "@lib/trend-queries.ts";

export interface FunnelInsight extends Insight {
    type: 'Funnel'
    config: InsightConfig & {
        funnel: FunnelInsightConfig
    }
}

export interface FunnelInsightConfig {
    duration: string
    steps?: FunnelStep[]
}

export interface FunnelStep {
    id: string
    name: string
    order: number
    query: Query
}

export const newFunnelInsight: Omit<FunnelInsight, 'id'> = {
    type: 'Funnel',
    config: {
        funnel: {
            duration: 'P30D',
            conversionWindow: 'P7D',
            steps: []
        }
    },
    favorite: false,
}
