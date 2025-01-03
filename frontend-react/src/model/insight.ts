import {TrendInsight} from "@/model/trend-insight.ts";

export type InsightType = 'Trend';

export interface Insight {
    id: number;
    name?: string;
    createdAt?: string;
    updatedAt?: string;
    type: InsightType;
}

export type UsableInsight = TrendInsight
export type UsableInsightInput = Omit<UsableInsight, 'id'>
