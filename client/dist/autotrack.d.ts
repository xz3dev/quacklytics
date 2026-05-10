import type { AnalyticsClient, EventProperties } from "./index";
export declare const DEFAULT_CLICK_SELECTORS: readonly ["a", "button", "input", "select", "textarea", "label", "summary", "[role='button']", "[role='link']", "[role='menuitem']", "[role='tab']", "[role='checkbox']", "[role='radio']", "[role='switch']"];
export interface ClickAutotrackOptions {
    client: Pick<AnalyticsClient, "send">;
    eventType?: string;
    selectors?: readonly string[];
    sessionId?: string | (() => string | undefined);
    personId?: string | (() => string | undefined);
    document?: Document;
    capture?: boolean;
    includeText?: boolean;
    maxPathDepth?: number;
    maxAttributeLength?: number;
    onError?: (error: unknown) => void;
}
export interface ClickAutotrackHandle {
    stop(): void;
}
export interface TrackPageviewOptions {
    client: Pick<AnalyticsClient, "send">;
    eventType?: string;
    properties?: EventProperties;
    sessionId?: string | (() => string | undefined);
    personId?: string | (() => string | undefined);
    document?: Document;
    location?: PageLocation;
}
export interface PageLocation {
    href: string;
    origin?: string;
    protocol?: string;
    host?: string;
    hostname?: string;
    port?: string;
    pathname?: string;
    search?: string;
    hash?: string;
}
export declare function enableClickAutotracking(options: ClickAutotrackOptions): ClickAutotrackHandle;
export declare function trackPageview(options: TrackPageviewOptions): Promise<void>;
//# sourceMappingURL=autotrack.d.ts.map