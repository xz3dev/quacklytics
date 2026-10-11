import { SDK_VERSION, type SdkEvent } from "./protocol.js";

export function sanitizeUrl(
  value: string,
  allowed: readonly string[] = [],
): string {
  if (!value) return "";
  try {
    const url = new URL(value, globalThis.location?.href);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    url.username = "";
    url.password = "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (!allowed.includes(key)) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return "";
  }
}
/** Browser, OS and device class, as attached to every browser event's context. */
export function describeUserAgent(userAgent: string) {
  return {
    browser: /Edg\//.test(userAgent)
      ? "Edge"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Other",
    os: /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad/.test(userAgent)
        ? "iOS"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac/.test(userAgent)
            ? "macOS"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "Other",
    deviceType: /iPad|Tablet/.test(userAgent)
      ? "tablet"
      : /Mobi|Android|iPhone/.test(userAgent)
        ? "mobile"
        : "desktop",
  } as const;
}
export function context(
  allowed: readonly string[],
  browser: boolean,
): SdkEvent["context"] {
  const base = {
    sdk: { name: "@quacklytics/client", version: SDK_VERSION },
  } as const;
  if (!browser) return base;
  return {
    ...base,
    page: {
      url: sanitizeUrl(location.href, allowed),
      path: location.pathname,
      title: document.title,
      referrer: sanitizeUrl(document.referrer),
    },
    ...describeUserAgent(navigator.userAgent),
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewport: { width: innerWidth, height: innerHeight },
  };
}

const observers = new Set<() => void>();
let stopObserving: (() => void) | undefined;
export function observeNavigation(listener: () => void): () => void {
  observers.add(listener);
  if (!stopObserving) {
    const push = history.pushState,
      replace = history.replaceState;
    const notify = () => {
      for (const callback of observers) callback();
    };
    const wrappedPush: History["pushState"] = function (
      this: History,
      ...args
    ) {
      push.apply(this, args);
      notify();
    };
    const wrappedReplace: History["replaceState"] = function (
      this: History,
      ...args
    ) {
      replace.apply(this, args);
      notify();
    };
    history.pushState = wrappedPush;
    history.replaceState = wrappedReplace;
    window.addEventListener("popstate", notify);
    document.addEventListener("astro:page-load", notify);
    stopObserving = () => {
      if (history.pushState === wrappedPush) history.pushState = push;
      if (history.replaceState === wrappedReplace)
        history.replaceState = replace;
      window.removeEventListener("popstate", notify);
      document.removeEventListener("astro:page-load", notify);
      stopObserving = undefined;
    };
  }
  return () => {
    observers.delete(listener);
    if (!observers.size) stopObserving?.();
  };
}
