import {TrendInsight} from "@/model/insights/trend-insight.ts";
import {ValueInsight} from "@/model/insights/value-insight.ts";
import {FunnelInsight} from "@/model/insights/funnel-insights.ts";
import {BreakdownInsight} from "@/model/insights/breakdown-insight.ts";
import {RetentionInsight} from "@/model/insights/retention-insight.ts";
import {PathInsight} from "@/model/insights/path-insight.ts";

export type InsightType = 'Trend' | 'Value' | 'Funnel' | 'Breakdown' | 'Retention' | 'Path';

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

export type UsableInsight = TrendInsight | ValueInsight | FunnelInsight | BreakdownInsight | RetentionInsight | PathInsight
export type UsableInsightInput = Omit<UsableInsight, 'id'>
