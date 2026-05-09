import type { AnalyticsClient } from "./index";
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
export declare function enableClickAutotracking(options: ClickAutotrackOptions): ClickAutotrackHandle;
//# sourceMappingURL=autotrack.d.ts.map