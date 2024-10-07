import type { PageLoad } from './$types'
import type { AnalyticsEvent } from '$lib/event'
import { createDb } from '$lib/duckdb'
import { buildEventQueryUrl, type QueryCondition } from '$lib/queries'

export const ssr = false
export const csr = true

export const load: PageLoad = async ({ params }) => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const conditions: QueryCondition[] = [
        {
            field: 'timestamp',
            operation: 'gte',
            value: sevenDaysAgo,
        },
        {
            field: 'properties',
            operation: 'gte',
            value: 80,
            jsonProperty: 'value'
        },
        {
            field: 'properties',
            operation: 'eq',
            value: false,
            jsonProperty: 'flag'
        }
    ];

    const queryUrl = buildEventQueryUrl('http://localhost:3000/events', conditions);

    const response = await fetch(queryUrl)
    const events = await response.json() as AnalyticsEvent[]
    console.log(events)
    const db = await createDb()
    await db.ping()
    await db.connect()
    return {
        events: events ?? [],
    }
}
