import { createClient } from "@quacklytics/client";
import { enableClickAutotracking } from "@quacklytics/client/autotrack";
import { createCookieConsent } from "@quacklytics/client/consent";

const apiKey = import.meta.env.PUBLIC_QUACKLYTICS_DEV_API_KEY;

if (import.meta.env.DEV && typeof document !== "undefined" && apiKey) {
  const client = createClient({
    apiKey,
    hostname: import.meta.env.PUBLIC_QUACKLYTICS_DEV_HOST ?? "localhost",
    port: Number(import.meta.env.PUBLIC_QUACKLYTICS_DEV_PORT ?? 3000),
    protocol: import.meta.env.PUBLIC_QUACKLYTICS_DEV_PROTOCOL ?? "http",
  });

  console.log(`Enabling dev tracking for Quacklytics with API key: ${apiKey}`);
  const consent = createCookieConsent({
    client,
    enabled: import.meta.env.PUBLIC_QUACKLYTICS_DEV_COOKIE_BANNER !== "false",
    banner: {
      textHtml:
        import.meta.env.PUBLIC_QUACKLYTICS_DEV_COOKIE_TEXT ??
        "This local dev site uses Quacklytics to test click tracking. Accept to persist a visitor id, or continue with session-only events.",
    },
    onError(error) {
      console.warn("Quacklytics dev tracking failed", error);
    },
  });

  enableClickAutotracking({
    client: consent.client,
    includeText: true,
    onError(error) {
      console.warn("Quacklytics click autotracking failed", error);
    },
  });

  queueMicrotask(() => consent.showBanner());
}
