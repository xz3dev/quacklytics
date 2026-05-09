export interface AnalyticsEvent {
    id: string;
    timestamp: Date;
    eventType: string;
    personId?: string;
    sessionId?: string;
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    properties: Record<string, any>;
}

export interface RawEventRow {
    id: string;
    event_type: string;
    person_id?: string;
    session_id?: string;
    timestamp: bigint; // DuckDB returns bigint for timestamp
    properties: string;

    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    [key: string]: any;
}
