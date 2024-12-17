import { authService } from '$lib/client/auth'
import type { Insight, TimeBucket } from '$lib/components/insight/Insight'
import moment from 'moment'
import { writable } from 'svelte/store'

export const createInsightMetaStore = (meta: InsightMeta) => {
    const { subscribe, set, update } = writable<InsightMeta>(meta)

    authService.checkAuth()
    return {
        subscribe,
        set,
        update: (data: Partial<InsightMeta>) =>
            update((meta) => ({ ...meta, ...data })),
    }
}

export interface InsightMeta {
    range: {
        start: Date
        end: Date
    }
    duration: string
    timeBucket: TimeBucket
}

export const metaStamps = (
    meta: InsightMeta,
): {
    start: Date
    end: Date
} => {
    if (meta.duration.includes(' - ')) {
        const [start, end] = meta.duration.split(' - ')
        return {
            start: moment(start).toDate(),
            end: moment(end).toDate(),
        }
    }

    const now = moment()

    switch (meta.duration) {
        case 'Last 7 Days':
            return {
                start: moment().subtract(7, 'days').toDate(),
                end: now.toDate(),
            }
        case 'Last 30 Days':
            return {
                start: moment().subtract(30, 'days').toDate(),
                end: now.toDate(),
            }
        case 'This Month':
            return {
                start: moment().startOf('month').toDate(),
                end: now.toDate(),
            }
        case 'Last Month':
            return {
                start: moment().subtract(1, 'month').startOf('month').toDate(),
                end: moment().startOf('month').toDate(),
            }
        default:
            return {
                start: moment().subtract(30, 'days').toDate(),
                end: now.toDate(),
            }
    }
}
