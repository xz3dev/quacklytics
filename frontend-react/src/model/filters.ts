import {TimeBucket, timeBucketData} from "@/model/trend-insight.ts";
import {determineDateRange} from "@/model/InsightDateRange.ts";
import {Query} from "@lib/queries.ts";
import {formatDuration} from "date-fns";
import {UTCDate} from "@date-fns/utc";

export interface Field {
    name: string
    type: string
    isProperty?: boolean
    alias?: string
}

export interface FieldFilter {
    field: Field
    operator: Operator
    value: string | number | Date
}

export const operators = [
    '=',
    '>',
    '<',
    '>=',
    '<=',
    '<>',
    'LIKE',
    'IN',
] as const
export type Operator = (typeof operators)[number]

export const buildDateRangeFilters = (start: UTCDate, end: UTCDate): FieldFilter[] => {
    const startFilter = {
        field: {
            name: 'timestamp',
            type: 'number',
        },
        operator: '>=',
        value: start,
    } satisfies FieldFilter
    const endFilter = {
        field: {
            name: 'timestamp',
            type: 'number',
        },
        operator: '<=',
        value: end,
    } satisfies FieldFilter
    return [startFilter, endFilter]
}

export const buildRangeFilters = (range: string | undefined): FieldFilter[] => {
    if (!range) return []
    const {start, end} = determineDateRange(range)
    return buildDateRangeFilters(start, end)
}

export const buildGroupByFilter = (timeBucket: TimeBucket, duration: string): Required<Pick<Query, 'groupBy' | 'orderBy'>> => {
    const alias = "trend_bucket"
    const dateRange = determineDateRange(duration)
    const origin = dateRange.start
    const bucketData = timeBucketData[timeBucket]
    const interval = formatDuration(bucketData.interval)
    const filterString = `time_bucket(INTERVAL '${interval}', timestamp, epoch_ms(${origin.getTime()}::bigint))`

    return {
        groupBy: [
            {
                name: filterString,
                type: 'string',
                alias,
            }
        ],
        orderBy: [
            {
                direction: 'ASC',
                field: {
                    name: alias,
                    type: 'number',
                    alias,
                }
            }
        ]
    }
}
