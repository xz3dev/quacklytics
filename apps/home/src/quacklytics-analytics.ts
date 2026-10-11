import { createClient, type AnalyticsClient } from "@quacklytics/client";
import { createCookieConsent } from "@quacklytics/client/consent";

declare global {
  interface Window {
    quacklytics?: AnalyticsClient;
  }
}
// Starlight's theme variables flip with its theme picker, so the banner follows it.
const STARLIGHT_BANNER_CSS = `
[data-quacklytics-cookie-banner] .ql-banner {
  color: var(--sl-color-white);
  background: var(--sl-color-bg-nav);
  border-color: var(--sl-color-gray-5);
  box-shadow: var(--sl-shadow-lg);
  font-family: var(--__sl-font);
  font-size: var(--sl-text-sm);
}
[data-quacklytics-cookie-banner] .ql-text a {
  color: var(--sl-color-text-accent);
}
[data-quacklytics-cookie-banner] button {
  border-radius: 999rem;
  padding: 0.4375rem 1.125rem;
}
[data-quacklytics-cookie-banner] .ql-primary {
  color: var(--sl-color-black);
  background: var(--sl-color-text-accent);
  border-color: var(--sl-color-text-accent);
}
[data-quacklytics-cookie-banner] .ql-secondary {
  color: var(--sl-color-white);
  background: transparent;
  border-color: var(--sl-color-gray-4);
}
`;
const apiKey = import.meta.env.PUBLIC_QUACKLYTICS_API_KEY;
const hostname =
  import.meta.env.PUBLIC_QUACKLYTICS_HOST ?? "http://localhost:3000";

if (typeof document !== "undefined" && apiKey && !window.quacklytics) {
  const client = createClient({
    apiKey,
    hostname,
    ...(import.meta.env.PUBLIC_QUACKLYTICS_PROTOCOL === "http"
      ? { protocol: "http" }
      : {}),
    ...(import.meta.env.PUBLIC_QUACKLYTICS_PORT
      ? { port: Number(import.meta.env.PUBLIC_QUACKLYTICS_PORT) }
      : {}),
    consent:
      import.meta.env.PUBLIC_QUACKLYTICS_COOKIE_BANNER === "false"
        ? "granted"
        : "required",
    autocapture: true,
    onError(error) {
      console.warn("Quacklytics collection failed", error);
    },
  });
  window.quacklytics = client;
  const consent = createCookieConsent({
    client,
    banner: {
      css: STARLIGHT_BANNER_CSS,
      ...(import.meta.env.PUBLIC_QUACKLYTICS_COOKIE_TEXT
        ? { textHtml: import.meta.env.PUBLIC_QUACKLYTICS_COOKIE_TEXT }
        : {}),
    },
  });
  queueMicrotask(() => consent.showBanner());
}
