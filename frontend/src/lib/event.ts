export interface AnalyticsEvent {
    id: string
    timestamp: Date
    eventType: string
    userId: string
    properties: Record<string, any>
}

export interface RawEventRow {
    id: Uint8Array;
    eventType: string;
    userId: Uint8Array;
    timestamp: bigint;  // DuckDB returns bigint for timestamp
    properties: string;

    [key: string]: any;
}
