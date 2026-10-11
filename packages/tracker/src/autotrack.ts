import type { AnalyticsClient, EventProperties } from "./index.js";
import { sanitizeUrl } from "./context.js";

export const DEFAULT_CLICK_SELECTORS = [
  "a",
  "button",
  "[role='button']",
  "[role='link']",
  "[data-ql-event]",
] as const;
export interface ClickAutotrackOptions {
  /** Consent is enforced by the client: it buffers, anonymizes, or sends each click. */
  client: Pick<AnalyticsClient, "track">;
  enabled?: () => boolean;
  selectors?: readonly string[];
  document?: Document;
  onError?: (error: unknown) => void;
}
export interface ClickAutotrackHandle {
  stop(): void;
}
export interface TrackPageviewOptions {
  client: Pick<AnalyticsClient, "page">;
  properties?: EventProperties;
}
export function trackPageview(options: TrackPageviewOptions) {
  return options.client.page(options.properties);
}
export function enableClickAutotracking(
  options: ClickAutotrackOptions,
): ClickAutotrackHandle {
  const doc = options.document ?? globalThis.document;
  if (!doc) throw new Error("Autocapture requires a browser");
  const selector = (options.selectors ?? DEFAULT_CLICK_SELECTORS).join(",");
  // Validate selectors during initialization, rather than throwing on a user click.
  doc.querySelector(selector);
  const listener = (event: MouseEvent) => {
    if (options.enabled?.() === false) return;
    const target = event.target;
    if (!doc.defaultView || !(target instanceof doc.defaultView.Element))
      return;
    if (target.closest("[data-ql-ignore], [data-quacklytics-cookie-banner]"))
      return;
    const element = target.closest(selector);
    if (!element || element.closest("[data-ql-ignore]")) return;
    const attributes: EventProperties = {};
    for (const key of ["role", "type", "data-ql-id"]) {
      const value = element.getAttribute(key);
      if (value) attributes[key] = value.slice(0, 128);
    }
    const properties: EventProperties = {
      tagName: element.tagName.toLowerCase(),
      attributes,
    };
    if (element instanceof doc.defaultView.HTMLAnchorElement)
      properties.href = sanitizeUrl(element.href);
    const eventType = element.getAttribute("data-ql-event") || "$click";
    void options.client
      .track(eventType, properties)
      .catch((error) => options.onError?.(error));
  };
  doc.addEventListener("click", listener, true);
  return { stop: () => doc.removeEventListener("click", listener, true) };
}
