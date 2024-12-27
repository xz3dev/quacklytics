

// src/components/EventsViewer.tsx
import {useEffect, useState} from "react";
import {AnalyticsEvent} from "@/model/event.ts";
import {useEventsQueryRunner} from "@/services/duck-db-manager.ts";

export function EventsViewer() {
    const runEventsQuery = useEventsQueryRunner()
    const [events, setEvents] = useState<AnalyticsEvent[]>([])

    useEffect(() => {
        const fetchEvents = async () => {
            const results = await runEventsQuery('SELECT * FROM events LIMIT 100')
            if (results) {
                setEvents(results)
            }
        }
        fetchEvents()
    }, [runEventsQuery])

    return (
        <div>
            {events.map(event => (
                <div key={event.id}>
                    {event.eventType} - {event.timestamp.toISOString()}
                </div>
            ))}
        </div>
    )
}
