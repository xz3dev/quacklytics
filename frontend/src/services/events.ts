import {useQuery} from "@tanstack/react-query";
import {http} from "@lib/fetch.ts";
import {AnalyticsEvent} from "@/model/event.ts";
import {db} from "@app/duckdb/duckdb.tsx";
import {UTCDate} from "@date-fns/utc";

const EVENTS_KEY = (projectId: string) => ['events', projectId];

export const EventsApi = {
    fetchEvents: async (projectId: string, since: UTCDate): Promise<AnalyticsEvent[]> => {
        const url = `${projectId}/events?timestamp__gt=${encodeURIComponent(since.toISOString())}`;
        const events = await http.get<AnalyticsEvent[]>(url);
        console.log(`Received ${events.length} events since ${since.toISOString()}`)
        await db.importEvents(events)
        return events
    }
}

export const useEvents = (projectId: string, since?: UTCDate) => {
    return useQuery(
        {
            queryKey: EVENTS_KEY(projectId),
            queryFn: () => EventsApi.fetchEvents(projectId, since ?? new UTCDate()),
            enabled: !!since,
        },
    );
};
