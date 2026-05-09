export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type EventProperties = Record<string, JsonValue>;
export type {
  ClickAutotrackHandle,
  ClickAutotrackOptions,
} from "./autotrack";
export {
  DEFAULT_CLICK_SELECTORS,
  enableClickAutotracking,
} from "./autotrack";

export interface AnalyticsClientConfig {
  apiKey: string;
  hostname: string;
  port?: number;
  protocol?: "http" | "https";
  fetch?: typeof fetch;
}

export interface AnalyticsEvent<
  TEventType extends string = string,
  TProperties extends EventProperties = EventProperties,
  TPersonProperties extends EventProperties = EventProperties,
> {
  eventType: TEventType;
  timestamp?: Date | string | number;
  sessionId?: string;
  personId?: string;
  properties?: TProperties;
  personProperties?: TPersonProperties;
}

export interface SendOptions {
  signal?: AbortSignal;
}

export interface AnalyticsClient {
  send<TEvent extends AnalyticsEvent>(event: TEvent, options?: SendOptions): Promise<void>;
  sendBatch<TEvent extends AnalyticsEvent>(events: readonly TEvent[], options?: SendOptions): Promise<void>;
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

  async function post(events: readonly AnalyticsEvent[], options?: SendOptions): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const request: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": config.apiKey,
      },
      body: JSON.stringify(events.map(serializeEvent)),
    };
    if (options?.signal) {
      request.signal = options.signal;
    }

    const response = await transport(endpoint, request);

    if (!response.ok) {
      const message = await response.text().catch(() => "");
      throw new Error(`Failed to send analytics events: ${response.status} ${message}`.trim());
    }
  }

  return {
    send: (event, options) => post([event], options),
    sendBatch: (events, options) => post(events, options),
  };
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
    url.pathname = joinPath(url.pathname, "/api/event");
    return url.toString();
  }

  return `${protocol}://${host}${port}/api/event`;
}

function joinPath(base: string, suffix: string): string {
  return `${base.replace(/\/+$/, "")}${suffix}`;
}

function serializeEvent(event: AnalyticsEvent): Record<string, unknown> {
  if (!event.eventType) {
    throw new Error("eventType is required");
  }

  return {
    eventType: event.eventType,
    timestamp: serializeTimestamp(event.timestamp),
    sessionId: event.sessionId,
    personId: event.personId,
    properties: event.properties ?? {},
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
