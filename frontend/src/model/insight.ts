import {TrendInsight} from "@/model/trend-insight.ts";
import {ValueInsight} from "@/model/value-insight.ts";

export type InsightType = 'Trend' | 'Value';

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

export type UsableInsight = TrendInsight | ValueInsight
export type UsableInsightInput = Omit<UsableInsight, 'id'>
