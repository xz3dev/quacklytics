import { z } from "zod";
import { trackPageview as sendPageview } from "./autotrack";
import type { TrackPageviewOptions } from "./autotrack";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type EventProperties = Record<string, JsonValue>;

export type {
  ClickAutotrackHandle,
  ClickAutotrackOptions,
  PageLocation,
  TrackPageviewOptions,
} from "./autotrack";
export {
  DEFAULT_CLICK_SELECTORS,
  enableClickAutotracking,
  trackPageview,
} from "./autotrack";

export interface AnalyticsClientConfig {
  apiKey: string;
  hostname: string;
  port?: number;
  protocol?: "http" | "https";
  fetch?: typeof fetch;
  autoTrackPageviews?: boolean;
  onError?: (error: unknown) => void;
}

export interface AnalyticsEvent<
  TEventType extends string = string,
  TProperties extends EventProperties = EventProperties,
  TPersonProperties extends EventProperties = EventProperties,
> {
  id?: string;
  eventType: TEventType;
  timestamp?: Date | string | number;
  sessionId?: string;
  personId?: string;
  properties?: TProperties;
  personProperties?: TPersonProperties;
}

export interface SendOptions {
  signal?: AbortSignal;
  /** Delay new Parquet snapshots for up to 10 seconds after this bulk batch.
   * Omit on the final batch to release the delay. Events are still committed durably.
   */
  deferExport?: boolean;
}

export type ClientTrackPageviewOptions = Omit<TrackPageviewOptions, "client">;

export interface AnalyticsClient {
  send<TEvent extends AnalyticsEvent>(
    event: TEvent,
    options?: SendOptions,
  ): Promise<void>;
  sendBatch<TEvent extends AnalyticsEvent>(
    events: readonly TEvent[],
    options?: SendOptions,
  ): Promise<void>;
  trackPageview(options?: ClientTrackPageviewOptions): Promise<void>;
}

export function createClient(config: AnalyticsClientConfig): AnalyticsClient {
  if (!config.apiKey) {
    throw new Error("apiKey is required");
  }
  if (!config.hostname) {
    throw new Error("hostname is required");
  }

  const transport = config.fetch ?? globalThis.fetch;
  if (!transport) {
    throw new Error("fetch is not available; provide config.fetch");
  }

  const endpoint = buildEndpoint(config);

  async function post(
    events: readonly AnalyticsEvent[],
    options?: SendOptions,
  ): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const request: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": config.apiKey,
      },
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        events: events.map(serializeEvent),
        ...(options?.deferExport ? { deferExport: true } : {}),
      }),
    };
    if (options?.signal) {
      request.signal = options.signal;
    }

    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await transport(endpoint, request);
      } catch (error) {
        if (options?.signal?.aborted || attempt === 2) throw error;
      }
      if (
        response &&
        (response.ok || (response.status < 500 && response.status !== 429))
      )
        break;
      if (attempt < 2)
        await new Promise<void>((resolve) =>
          setTimeout(resolve, 250 * 2 ** attempt),
        );
    }
    if (!response) throw new Error("Analytics transport failed");

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(
        `Failed to send analytics events: ${response.status} ${message}`.trim(),
      );
    }
  }

  const client: AnalyticsClient = {
    send: (event, options) => post([event], options),
    sendBatch: (events, options) => post(events, options),
    trackPageview: (options = {}) => sendPageview({ ...options, client }),
  };

  if (config.autoTrackPageviews !== false) {
    scheduleInitialPageview(client, config.onError);
  }

  return client;
}

function buildEndpoint(config: AnalyticsClientConfig): string {
  const protocol = config.protocol ?? "http";
  const host = config.hostname.replace(/\/+$/, "");
  const port = config.port == null ? "" : `:${config.port}`;

  if (host.startsWith("http://") || host.startsWith("https://")) {
    const url = new URL(host);
    if (config.port != null) {
      url.port = String(config.port);
    }
    url.pathname = joinPath(url.pathname, "/api/ingest");
    return url.toString();
  }

  return `${protocol}://${host}${port}/api/ingest`;
}

function joinPath(base: string, suffix: string): string {
  return `${base.replace(/\/+$/, "")}${suffix}`;
}

function serializeEvent(event: AnalyticsEvent): Record<string, unknown> {
  if (!event.eventType) {
    throw new Error("eventType is required");
  }

  return {
    id: event.id ?? crypto.randomUUID(),
    eventType: event.eventType,
    timestamp: serializeTimestamp(event.timestamp),
    sessionId: event.sessionId,
    personId: event.personId,
    properties: {
      ...collectClientContext(),
      ...(event.properties ?? {}),
    },
    personProperties: event.personProperties ?? {},
  };
}

function serializeTimestamp(timestamp: AnalyticsEvent["timestamp"]): string {
  if (timestamp == null) {
    return new Date().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  if (typeof timestamp === "number") {
    return new Date(timestamp).toISOString();
  }
  return timestamp;
}

function scheduleInitialPageview(
  client: AnalyticsClient,
  onError: ((error: unknown) => void) | undefined,
): void {
  const doc = globalThis.document;
  if (!doc) {
    return;
  }

  const send = () => {
    void client.trackPageview().catch((error) => onError?.(error));
  };

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", send, { once: true });
    return;
  }

  queueMicrotask(send);
}

interface NavigatorUserAgentData {
  brands?: readonly NavigatorUserAgentBrand[] | undefined;
  mobile?: boolean | undefined;
  platform?: string | undefined;
}

interface NavigatorUserAgentBrand {
  brand: string;
  version: string;
}

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: NavigatorUserAgentData;
};

function collectClientContext(): EventProperties {
  const nav = globalThis.navigator;
  const win = globalThis.window;
  const doc = globalThis.document;
  const ua = nav?.userAgent ?? "";
  const raw: unknown =
    nav && "userAgentData" in nav ? nav.userAgentData : undefined;
  const parsed = z
    .object({
      brands: z
        .array(z.object({ brand: z.string(), version: z.string() }))
        .optional(),
      mobile: z.boolean().optional(),
      platform: z.string().optional(),
    })
    .safeParse(raw);
  const uaData = parsed.success ? parsed.data : undefined;
  const browser = parseBrowser(ua, uaData);
  const os = parseOperatingSystem(ua, uaData);
  const device = parseDevice(ua, uaData);
  const properties: EventProperties = {};

  setProperty(properties, "userAgent", ua);
  setProperty(properties, "browser", browser.name);
  setProperty(properties, "browserVersion", browser.version);
  setProperty(properties, "os", os.name);
  setProperty(properties, "osVersion", os.version);
  setProperty(properties, "deviceType", device.type);
  setProperty(properties, "deviceModel", device.model);
  setProperty(properties, "platform", uaData?.platform ?? nav?.platform);
  setProperty(properties, "language", nav?.language);
  setProperty(properties, "timezone", getTimezone());
  setProperty(properties, "viewportWidth", win?.innerWidth);
  setProperty(properties, "viewportHeight", win?.innerHeight);
  setProperty(properties, "screenWidth", win?.screen?.width);
  setProperty(properties, "screenHeight", win?.screen?.height);
  setProperty(properties, "pageUrl", win?.location?.href);
  setProperty(properties, "pagePath", win?.location?.pathname);
  setProperty(properties, "referrer", doc?.referrer);

  return properties;
}

function parseBrowser(
  userAgent: string,
  uaData: NavigatorUserAgentData | undefined,
): { name?: string; version?: string } {
  const brand = uaData?.brands?.find(
    (candidate) => !candidate.brand.includes("Not"),
  )?.brand;

  const candidates: Array<[RegExp, string]> = [
    [/(?:Edg|Edge)\/([0-9.]+)/, "Edge"],
    [/OPR\/([0-9.]+)/, "Opera"],
    [/SamsungBrowser\/([0-9.]+)/, "Samsung Internet"],
    [/CriOS\/([0-9.]+)/, "Chrome"],
    [/Chrome\/([0-9.]+)/, "Chrome"],
    [/FxiOS\/([0-9.]+)/, "Firefox"],
    [/Firefox\/([0-9.]+)/, "Firefox"],
    [/Version\/([0-9.]+).*Safari\//, "Safari"],
    [/MSIE ([0-9.]+)/, "Internet Explorer"],
    [/Trident\/.*rv:([0-9.]+)/, "Internet Explorer"],
  ];

  for (const [pattern, name] of candidates) {
    const match = userAgent.match(pattern);
    if (match?.[1]) {
      return withVersion(name, match[1]);
    }
  }

  if (brand) {
    const version = uaData?.brands?.find(
      (candidate) => candidate.brand === brand,
    )?.version;
    return withVersion(brand, version);
  }

  return {};
}

function parseOperatingSystem(
  userAgent: string,
  uaData: NavigatorUserAgentData | undefined,
): { name?: string; version?: string } {
  const platform = uaData?.platform;
  const normalizedPlatform = platform?.toLowerCase();

  if (
    normalizedPlatform?.includes("windows") ||
    userAgent.includes("Windows")
  ) {
    return withVersion(
      "Windows",
      firstMatch(userAgent, /Windows NT ([0-9.]+)/),
    );
  }
  if (
    normalizedPlatform?.includes("android") ||
    userAgent.includes("Android")
  ) {
    return withVersion("Android", firstMatch(userAgent, /Android ([0-9.]+)/));
  }
  if (/iPhone|iPad|iPod/.test(userAgent)) {
    return withVersion(
      "iOS",
      firstMatch(userAgent, /OS ([0-9_]+)/)?.replace(/_/g, "."),
    );
  }
  if (normalizedPlatform?.includes("mac") || userAgent.includes("Mac OS X")) {
    return withVersion(
      "macOS",
      firstMatch(userAgent, /Mac OS X ([0-9_]+)/)?.replace(/_/g, "."),
    );
  }
  if (userAgent.includes("CrOS")) {
    return withVersion(
      "Chrome OS",
      firstMatch(userAgent, /CrOS [^ ]+ ([0-9.]+)/),
    );
  }
  if (normalizedPlatform?.includes("linux") || userAgent.includes("Linux")) {
    return { name: "Linux" };
  }

  return platform ? { name: platform } : {};
}

function parseDevice(
  userAgent: string,
  uaData: NavigatorUserAgentData | undefined,
): { type?: string; model?: string } {
  if (/bot|crawler|spider|crawling/i.test(userAgent)) {
    return { type: "bot" };
  }

  const model =
    firstMatch(userAgent, /\b(iPhone|iPad|iPod)\b/) ??
    firstMatch(userAgent, /\b(Pixel [^;)]+)/) ??
    firstMatch(userAgent, /\b(SM-[A-Z0-9]+)\b/) ??
    firstMatch(userAgent, /Android [^;]+;\s*([^;)]+)\)/);

  if (
    /iPad|Tablet|PlayBook|Silk/i.test(userAgent) ||
    /Android(?!.*Mobile)/i.test(userAgent)
  ) {
    return withModel("tablet", model);
  }
  if (uaData?.mobile || /Mobi|iPhone|iPod|Android.*Mobile/i.test(userAgent)) {
    return withModel("mobile", model);
  }

  return withModel("desktop", model);
}

function firstMatch(value: string, pattern: RegExp): string | undefined {
  return value.match(pattern)?.[1];
}

function withVersion(
  name: string,
  version: string | undefined,
): { name: string; version?: string } {
  return version ? { name, version } : { name };
}

function withModel(
  type: string,
  model: string | undefined,
): { type: string; model?: string } {
  return model ? { type, model } : { type };
}

function getTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function setProperty(
  properties: EventProperties,
  key: string,
  value: JsonValue | undefined,
): void {
  if (value !== undefined && value !== "") {
    properties[key] = value;
  }
}
