import type { PageLoad } from './$types'
import type { AnalyticsEvent } from '$lib/event'
import { createDb } from '$lib/duckdb'

export const ssr = false
export const csr = true

export const load: PageLoad = async ({ params }) => {
    const response = await fetch('http://localhost:3000/events')
    const events = await response.json() as AnalyticsEvent[]
    console.log(events)
    const db = await createDb()
    await db.ping()
    await db.connect()
    return {
        events: events ?? [],
    }
}
