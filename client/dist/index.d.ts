import type { TrackPageviewOptions } from "./autotrack";
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
export type EventProperties = Record<string, JsonValue>;
export type { ClickAutotrackHandle, ClickAutotrackOptions, PageLocation, TrackPageviewOptions, } from "./autotrack";
export { DEFAULT_CLICK_SELECTORS, enableClickAutotracking, trackPageview, } from "./autotrack";
export interface AnalyticsClientConfig {
    apiKey: string;
    hostname: string;
    port?: number;
    protocol?: "http" | "https";
    fetch?: typeof fetch;
    autoTrackPageviews?: boolean;
    onError?: (error: unknown) => void;
}
export interface AnalyticsEvent<TEventType extends string = string, TProperties extends EventProperties = EventProperties, TPersonProperties extends EventProperties = EventProperties> {
    eventType: TEventType;
    timestamp?: Date | string | number;
    sessionId?: string;
    personId?: string;
    properties?: TProperties;
    personProperties?: TPersonProperties;
}
export interface SendOptions {
    signal?: AbortSignal;
}
export type ClientTrackPageviewOptions = Omit<TrackPageviewOptions, "client">;
export interface AnalyticsClient {
    send<TEvent extends AnalyticsEvent>(event: TEvent, options?: SendOptions): Promise<void>;
    sendBatch<TEvent extends AnalyticsEvent>(events: readonly TEvent[], options?: SendOptions): Promise<void>;
    trackPageview(options?: ClientTrackPageviewOptions): Promise<void>;
}
export declare function createClient(config: AnalyticsClientConfig): AnalyticsClient;
//# sourceMappingURL=index.d.ts.map