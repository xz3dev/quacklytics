import {Insight, InsightConfig} from "@/model/insights/insight.ts";
import {Query} from "@lib/trend-queries.ts";
import {Field} from "@/model/filters.ts";

export interface PathInsight extends Insight {
    type: 'Path'
    config: InsightConfig & {
        path: PathInsightConfig
    }
}

export type PathDirection = 'forward' | 'backward'

export interface PathInsightConfig {
    duration: string
    anchorQuery: Query
    direction: PathDirection
    stepField: Field
    maxSteps?: number
    limit?: number
}

export const newPathInsight: Omit<PathInsight, 'id'> = {
    type: 'Path',
    config: {
        path: {
            duration: 'P30D',
            anchorQuery: {
                filters: [],
            },
            direction: 'forward',
            stepField: {
                name: 'event_type',
                type: 'string',
            },
            maxSteps: 5,
            limit: 10,
        },
    },
    favorite: false,
}
