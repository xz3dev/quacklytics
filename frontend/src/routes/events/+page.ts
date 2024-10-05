import type { PageLoad } from './$types'
import type { AnalyticsEvent } from '$lib/event'

export const ssr = true

export const load: PageLoad = async ({ params }) => {
    const response = await fetch('http://localhost:3000/events')
    const events = await response.json() as AnalyticsEvent[]
    console.log(events)
    return {
        events: events ?? [],
    }
}
