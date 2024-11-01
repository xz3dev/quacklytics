export type InsightType = 'Trend'

export abstract class Insight {
    id: string = crypto.randomUUID()
    abstract type: InsightType
}

export const timeBuckets = ['Daily', 'Weekly', 'Monthly'] as const
export type TimeBucket = typeof timeBuckets[number]
export const timeBucketLabels: {
    [key in TimeBucket]: string
} = {
    Daily: 'Day',
    Weekly: 'Week',
    Monthly: 'Month',
}
