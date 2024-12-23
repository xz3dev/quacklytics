export type InsightType = 'Trend';

export interface Insight {
    id: number;
    name?: string;
    createdAt?: string;
    updatedAt?: string;
    type: InsightType;
}
