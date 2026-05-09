import type { AnalyticsClient } from "./index";
export type ConsentDecision = "accepted" | "rejected";
export interface CookieConsentOptions {
    client: Pick<AnalyticsClient, "send" | "sendBatch">;
    enabled?: boolean;
    document?: Document;
    cookieDomain?: string;
    cookiePrefix?: string;
    persistentDays?: number;
    banner?: CookieBannerOptions;
    onError?: (error: unknown) => void;
}
export interface CookieBannerOptions {
    textHtml?: string;
    acceptLabel?: string;
    rejectLabel?: string;
}
export interface CookieConsentController {
    client: AnalyticsClient;
    decision(): ConsentDecision | undefined;
    accept(): void;
    reject(): void;
    reset(): void;
    showBanner(options?: CookieBannerOptions): CookieBannerHandle | undefined;
}
export interface CookieBannerHandle {
    close(): void;
}
export declare function createCookieConsent(options: CookieConsentOptions): CookieConsentController;
//# sourceMappingURL=consent.d.ts.map