export type InsightType = 'Trend'

export abstract class Insight {
    id: string = crypto.randomUUID()
    abstract type: InsightType
}
