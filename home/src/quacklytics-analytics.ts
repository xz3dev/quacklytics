import { createClient } from "@quacklytics/client";
import { enableClickAutotracking } from "@quacklytics/client/autotrack";
import { createCookieConsent } from "@quacklytics/client/consent";

const apiKey = import.meta.env.PUBLIC_QUACKLYTICS_API_KEY;
const hostname = import.meta.env.PUBLIC_QUACKLYTICS_HOST ?? "localhost";
const port = parsePort(import.meta.env.PUBLIC_QUACKLYTICS_PORT, hostname);
const protocol = parseProtocol(import.meta.env.PUBLIC_QUACKLYTICS_PROTOCOL);

if (typeof document !== "undefined" && apiKey) {
  const client = createClient({
    apiKey,
    hostname,
    port,
    protocol,
    autoTrackPageviews: false,
  });

  console.log("Quacklytics homepage tracking enabled");
  const consent = createCookieConsent({
    client,
    enabled: import.meta.env.PUBLIC_QUACKLYTICS_COOKIE_BANNER !== "false",
    banner: {
      textHtml:
        import.meta.env.PUBLIC_QUACKLYTICS_COOKIE_TEXT ??
        "We use Quacklytics to understand which parts of this site are useful. Accept to persist a visitor id, or continue with session-only analytics.",
    },
    onError(error) {
      console.warn("Quacklytics homepage tracking failed", error);
    },
  });

  enableClickAutotracking({
    client: consent.client,
    includeText: true,
    onError(error) {
      console.warn("Quacklytics click autotracking failed", error);
    },
  });

  void consent.client.trackPageview().catch((error) => {
    console.warn("Quacklytics pageview tracking failed", error);
  });

  queueMicrotask(() => consent.showBanner());
}

function parsePort(value: string | undefined, hostname: string): number | undefined {
  if (value) {
    const port = Number(value);
    return Number.isFinite(port) ? port : undefined;
  }
  return hostname === "localhost" ? 3000 : undefined;
}

function parseProtocol(value: string | undefined): "http" | "https" {
  return value === "https" ? "https" : "http";
}
