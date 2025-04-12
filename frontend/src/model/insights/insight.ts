import {TrendInsight} from "@/model/insights/trend-insight.ts";
import {ValueInsight} from "@/model/insights/value-insight.ts";
import {FunnelInsight} from "@/model/insights/funnel-insights.ts";

export type InsightType = 'Trend' | 'Value' | 'Funnel';

export interface Insight {
    id: number;
    name?: string;
    createdAt?: string;
    updatedAt?: string;
    type: InsightType;
    favorite: boolean
    config: InsightConfig
}

export interface InsightConfig {}

export type UsableInsight = TrendInsight | ValueInsight | FunnelInsight
export type UsableInsightInput = Omit<UsableInsight, 'id'>
