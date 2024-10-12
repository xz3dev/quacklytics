export interface AnalyticsEvent {
    id: string
    timestamp: Date
    eventType: string
    userId: string
    properties: Record<string, any>
}

export interface RawEventRow {
    id: string;
    event_type: string;
    user_id: string;
    timestamp: bigint;  // DuckDB returns bigint for timestamp
    properties: string;

    [key: string]: any;
}
