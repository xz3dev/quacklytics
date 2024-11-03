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


const insightColors = [
    '#4d7aa8',
    '#8f0030',
    '#368163',
    '#cf8626',
    '#ab49a3',
]

export const insightColor = (i: number): string => {
    return insightColors[i % insightColors.length]
}
