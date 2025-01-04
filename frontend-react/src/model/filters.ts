import {TimeBucket} from "@/model/trend-insight.ts";
import {determineDateRange} from "@/model/InsightDateRange.ts";
import {Query} from "@lib/queries.ts";

export interface Field {
    name: string
    type: string
    isProperty?: boolean
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

export const buildRangeFilters = (range: string | undefined): FieldFilter[] => {
    if(!range) return []
    const {start, end} = determineDateRange(range)
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


export const buildGroupByFilter = (timeBucket: TimeBucket): Required<Pick<Query, 'groupBy' | 'orderBy'>> => {
    const alias = "bucket_0"
    const dateTruncate =
        timeBucket === 'Daily'
            ? 'day'
            : timeBucket === 'Weekly'
                ? 'week'
                : 'month'
    const filterString = `date_trunc('${dateTruncate}', timestamp)`

    return {
        groupBy: [
            {
                name: filterString,
                type: 'string',
            }
        ],
        orderBy: [
            {
                direction: 'ASC',
                field: {
                    name: alias,
                    type: 'number',
                }
            }
        ]
    }
}
