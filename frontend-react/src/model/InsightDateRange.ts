import {
    endOfDay,
    endOfMonth,
    format,
    formatDuration,
    startOfDay,
    startOfMonth,
    subDays,
    subMonths,
    subSeconds
} from "date-fns"

import * as iso from "iso8601-duration"

export const predefinedRanges = [
    {label: 'Today', value: 'today'},
    {label: 'Yesterday', value: 'yesterday'},
    {label: 'Last 24 hours', value: 'P24H'},
    {label: 'Last 7 days', value: 'P7D'},
    {label: 'Last 14 days', value: 'P14D'},
    {label: 'Last 30 days', value: 'P30D'},
    {label: 'Last 90 days', value: 'P90D'},
    {label: 'Last 180 days', value: 'P180D'},
    {label: 'This month', value: 'thisMonth'},
    {label: 'Last month', value: 'lastMonth'},
    {label: 'Year to date', value: 'yearToDate'},
    {label: 'All time', value: 'allTime'},
]

export type InsightDateRange = {
    label: string
    value: string
}

export const determineLabel = (range: string | undefined): string => {
    if (!range) return 'All time'
    const predefined = predefinedRanges.find(r => r.value === range)?.label
    if (predefined) return predefined

    if (range.startsWith('P')) {
        const d = iso.parse(range)
        return 'Last ' + formatDuration(d, {format: ['years', 'months', 'days'], zero: false})
    }

    const {start, end} = determineDateRange(range)
    return `${format(start, 'LLL d, yyyy')} - ${format(end, 'LLL d, yyyy')}`
}

export const determineDateRange = (range: string | undefined): {
    start: Date
    end: Date
} => {
    if (!range) {
        return {
            start: startOfMonth(new Date(1000, 0, 1)),
            end: endOfDay(new Date()),
        }
    }
    if (range.startsWith('P')) {
        const end = endOfDay(new Date())
        const duration = iso.parse(range)
        if (!duration) throw Error('Invalid duration')
        const seconds = iso.toSeconds(duration, end)
        const start = subSeconds(end, seconds)

        return {
            start,
            end,
        }
    }
    if (range === 'today') {
        return {
            start: startOfDay(new Date()),
            end: endOfDay(new Date()),
        }
    }
    if (range === 'yesterday') {
        const yesterday = subDays(new Date(), 1)
        return {
            start: startOfDay(yesterday),
            end: endOfDay(yesterday),
        }
    }
    if (range === 'thisMonth') {
        return {
            start: startOfMonth(new Date()),
            end: endOfDay(new Date()),
        }
    }
    if (range === 'lastMonth') {
        const lastMonth = subMonths(new Date(), 1)
        return {
            start: startOfMonth(lastMonth),
            end: endOfMonth(lastMonth),
        }
    }
    if (range === 'yearToDate') {
        return {
            start: endOfDay(new Date()),
            end: endOfDay(new Date()),
        }
    }
    if (range === 'allTime') {
        return {
            start: startOfMonth(new Date(1000, 0, 1)),
            end: endOfDay(new Date()),
        }
    }
    if (range.includes(' - ')) {
        // custom date range like this '2023-01-01 - 2023-01-10'
        const [start, end] = range.split(' - ')
        return {
            start: new Date(start),
            end: new Date(end),
        }
    }
    throw Error('Invalid date range')
}
