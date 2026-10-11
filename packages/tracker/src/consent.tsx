import { render } from "preact";
import type { AnalyticsClient } from "./index.js";

export interface CookieBannerOptions {
  textHtml?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  /**
   * Extra CSS appended after the default banner styles. Scope selectors with
   * `[data-quacklytics-cookie-banner]` and target `.ql-banner`, `.ql-text`,
   * `.ql-actions`, `.ql-primary` (accept) or `.ql-secondary` (reject).
   */
  css?: string;
}
export interface CookieBannerHandle {
  close(): void;
}
type ConsentClient = Pick<AnalyticsClient, "getConsent" | "setConsent">;
export interface CookieConsentOptions<
  Client extends ConsentClient = ConsentClient,
> {
  client: Client;
  enabled?: boolean;
  document?: Document;
  banner?: CookieBannerOptions;
}
const DEFAULT_BANNER_HTML =
  "Allow analytics to help us understand how this site is used?";
/** Presentation only: consent and storage are always enforced by the client. */
export function createCookieConsent<Client extends ConsentClient>(
  options: CookieConsentOptions<Client>,
) {
  const doc = options.document ?? globalThis.document;
  let banner: CookieBannerHandle | undefined;
  const decide = (state: "granted" | "denied") => {
    options.client.setConsent(state);
    banner?.close();
    banner = undefined;
  };
  if (options.enabled === false) decide("granted");
  return {
    client: options.client,
    decision: () => options.client.getConsent(),
    accept: () => decide("granted"),
    reject: () => decide("denied"),
    showBanner(override?: CookieBannerOptions) {
      if (
        !doc ||
        options.enabled === false ||
        options.client.getConsent() !== "pending"
      )
        return undefined;
      banner?.close();
      banner = renderCookieBanner(doc, {
        ...options.banner,
        ...override,
        onAccept: () => decide("granted"),
        onReject: () => decide("denied"),
      });
      return banner;
    },
    destroy() {
      banner?.close();
      banner = undefined;
    },
  };
}

interface RenderCookieBannerOptions extends CookieBannerOptions {
  onAccept: () => void;
  onReject: () => void;
}

function renderCookieBanner(
  doc: Document,
  options: RenderCookieBannerOptions,
): CookieBannerHandle {
  const container = doc.createElement("div");
  container.setAttribute("data-quacklytics-cookie-banner", "");
  // Inherit the page's declared color-scheme (so theme toggles apply live);
  // pages that declare none get the visitor's OS preference instead.
  const pageScheme = doc.defaultView
    ?.getComputedStyle(doc.documentElement)
    .getPropertyValue("color-scheme")
    .trim();
  if (!pageScheme || pageScheme === "normal")
    container.style.setProperty("color-scheme", "light dark");
  doc.body.appendChild(container);

  const close = () => {
    render(null, container);
    container.remove();
  };

  render(
    <CookieBanner
      textHtml={options.textHtml ?? DEFAULT_BANNER_HTML}
      acceptLabel={options.acceptLabel ?? "Accept"}
      rejectLabel={options.rejectLabel ?? "Reject"}
      css={options.css}
      onAccept={options.onAccept}
      onReject={options.onReject}
    />,
    container,
  );

  return { close };
}

interface CookieBannerProps {
  textHtml: string;
  acceptLabel: string;
  rejectLabel: string;
  css: string | undefined;
  onAccept: () => void;
  onReject: () => void;
}

function CookieBanner(props: CookieBannerProps) {
  return (
    <div
      class="ql-banner"
      role="dialog"
      aria-live="polite"
      aria-label="Analytics consent"
    >
      <style>{BANNER_CSS}</style>
      {props.css ? <style>{props.css}</style> : null}
      <div
        class="ql-text"
        dangerouslySetInnerHTML={{ __html: props.textHtml }}
      />
      <div class="ql-actions">
        <button type="button" class="ql-secondary" onClick={props.onReject}>
          {props.rejectLabel}
        </button>
        <button type="button" class="ql-primary" onClick={props.onAccept}>
          {props.acceptLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Colors follow the host page's `color-scheme` via `light-dark()`; the plain
 * declaration before each one is the light fallback for older browsers.
 */
const BANNER_CSS = `
[data-quacklytics-cookie-banner] .ql-banner {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  width: min(420px, calc(100vw - 32px));
  box-sizing: border-box;
  display: grid;
  gap: 14px;
  padding: 16px;
  color: #111827;
  color: light-dark(#111827, #f3f4f6);
  background: rgba(255, 255, 255, 0.96);
  background: light-dark(rgba(255, 255, 255, 0.96), rgba(17, 24, 39, 0.96));
  border: 1px solid rgba(17, 24, 39, 0.16);
  border-color: light-dark(rgba(17, 24, 39, 0.16), rgba(243, 244, 246, 0.16));
  border-radius: 8px;
  box-shadow: 0 18px 60px rgba(17, 24, 39, 0.18);
  box-shadow: 0 18px 60px light-dark(rgba(17, 24, 39, 0.18), rgba(0, 0, 0, 0.5));
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
  line-height: 1.45;
}
[data-quacklytics-cookie-banner] .ql-text {
  margin: 0;
}
[data-quacklytics-cookie-banner] .ql-text a {
  color: inherit;
}
[data-quacklytics-cookie-banner] .ql-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
[data-quacklytics-cookie-banner] button {
  margin: 0;
  border-radius: 6px;
  padding: 8px 12px;
  font: inherit;
  cursor: pointer;
}
[data-quacklytics-cookie-banner] .ql-primary {
  border: 1px solid #111827;
  border-color: light-dark(#111827, #f3f4f6);
  background: #111827;
  background: light-dark(#111827, #f3f4f6);
  color: #ffffff;
  color: light-dark(#ffffff, #111827);
}
[data-quacklytics-cookie-banner] .ql-secondary {
  border: 1px solid rgba(17, 24, 39, 0.18);
  border-color: light-dark(rgba(17, 24, 39, 0.18), rgba(243, 244, 246, 0.24));
  background: #ffffff;
  background: light-dark(#ffffff, #1f2937);
  color: #111827;
  color: light-dark(#111827, #f3f4f6);
}
`;
