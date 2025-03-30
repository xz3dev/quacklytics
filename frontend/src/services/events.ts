import {useQuery} from "@tanstack/react-query";
import {http} from "@lib/fetch.ts";
import {AnalyticsEvent} from "@/model/event.ts";
import {UTCDate} from "@date-fns/utc";
import {useDuckDb} from "@app/duckdb/duckdb-provider.tsx";
import {DuckDbManager} from "@/services/duck-db-manager.ts";

const EVENTS_KEY = (projectId: string) => ['events', projectId];

export const EventsApi = {
    fetchEvents: async (projectId: string, since: UTCDate, db: DuckDbManager): Promise<AnalyticsEvent[]> => {
        const url = `${projectId}/events?timestamp__gt=${encodeURIComponent(since.toISOString())}`;
        const events = await http.get<AnalyticsEvent[]>(url);
        if (events && events.length > 0) {
            await db.importEvents(events)
        }
        return events
    }
}

export const useEvents = (projectId: string, since?: UTCDate) => {
    const db = useDuckDb()
    return useQuery(
        {
            queryKey: EVENTS_KEY(projectId),
            queryFn: () => EventsApi.fetchEvents(projectId, since ?? new UTCDate(), db),
            enabled: !!since,
        },
    );
};
