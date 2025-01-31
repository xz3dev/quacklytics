import {
    endOfDay,
    endOfMonth,
    format,
    formatDuration,
    startOfDay,
    startOfMonth,
    startOfYear,
    subDays,
    subMonths,
    subSeconds
} from "date-fns"

import * as iso from "iso8601-duration"
import {UTCDate} from "@date-fns/utc";

export const predefinedRanges = [
    {label: 'Today', value: 'today'},
    {label: 'Yesterday', value: 'yesterday'},
    {label: 'Last 24 hours', value: 'PT24H'},
    {label: 'Last 7 days', value: 'P7D'},
    {label: 'Last 14 days', value: 'P14D'},
    {label: 'Last 30 days', value: 'P30D'},
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

interface DateRange {
    start: UTCDate
    end: UTCDate
}

export const determinePreviousDateRange = (range: string | undefined): DateRange => {
    const currentRange = determineDateRange(range)
    const diffInMilliseconds = currentRange.end.getTime() - currentRange.start.getTime()
    const newStart = new UTCDate()
    newStart.setTime(currentRange.start.getTime() - diffInMilliseconds)
    return {
        start: newStart,
        end: currentRange.start,
    }
}

export const determineDateRange = (range: string | undefined): DateRange => {
    if (!range) {
        return {
            start: startOfMonth(new UTCDate(1000, 0, 1)),
            end: endOfDay(new UTCDate()),
        }
    }
    if (range.startsWith('P')) {
        const end = new UTCDate()
        const duration = iso.parse(range)
        if (!duration) throw Error('Invalid duration')
        const seconds = iso.toSeconds(duration, end)
        const start = subSeconds(end, seconds)

        const secondsPerDay = 24 * 60 * 60
        const days = Math.floor(seconds / secondsPerDay)
        if (days > 0) {
            return {
                start: startOfDay(start),
                end: endOfDay(end),
            }
        }

        return {
            start,
            end,
        }
    }
    if (range === 'today') {
        return {
            start: startOfDay(new UTCDate()),
            end: endOfDay(new UTCDate()),
        }
    }
    if (range === 'yesterday') {
        const yesterday = subDays(new UTCDate(), 1)
        return {
            start: startOfDay(yesterday),
            end: endOfDay(yesterday),
        }
    }
    if (range === 'thisMonth') {
        return {
            start: startOfMonth(new UTCDate()),
            end: endOfDay(new UTCDate()),
        }
    }
    if (range === 'lastMonth') {
        const lastMonth = subMonths(new UTCDate(), 1)
        return {
            start: startOfDay(startOfMonth(lastMonth)),
            end: endOfDay(endOfMonth(lastMonth)),
        }
    }
    if (range === 'yearToDate') {
        return {
            start: startOfDay(startOfYear(new UTCDate())),
            end: endOfDay(endOfDay(new UTCDate())),
        }
    }
    if (range === 'allTime') {
        return {
            start: startOfDay(startOfMonth(new UTCDate(1000, 0, 1))),
            end: endOfDay(new UTCDate()),
        }
    }
    if (range.includes(' - ')) {
        // custom date range like this '2023-01-01 - 2023-01-10'
        const [start, end] = range.split(' - ')
        return {
            start: startOfDay(new UTCDate(start)),
            end: endOfDay(new UTCDate(end)),
        }
    }
    throw Error('Invalid date range')
}
