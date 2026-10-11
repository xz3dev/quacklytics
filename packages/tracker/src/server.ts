import {
  createClient,
  type AnalyticsClientConfig,
  type EventProperties,
} from "./index.js";
export type {
  AnalyticsEvent,
  CaptureOptions,
  EventProperties,
  SendOptions,
} from "./index.js";
/** Explicit identities only; no browser storage, consent UI, or automatic collection. */
export function createServerClient<
  Events extends { [Name in keyof Events]: EventProperties } = Record<
    string,
    EventProperties
  >,
>(
  config: Omit<
    AnalyticsClientConfig,
    "runtime" | "consent" | "autocapture" | "autoTrackPageviews"
  >,
) {
  return createClient<Events>({
    ...config,
    runtime: "server",
    autoTrackPageviews: false,
    autocapture: false,
  });
}
