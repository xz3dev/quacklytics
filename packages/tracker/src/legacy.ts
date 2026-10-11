export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export type EventProperties = Record<string, JsonValue>;

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
  /** Import historical events, including months already archived to S3.
   * The request completes once archived months have been merged and re-uploaded.
   */
  backfill?: boolean;
}

export interface ClientTrackPageviewOptions {
  properties?: EventProperties;
}

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
        response = await transport(
          options?.backfill
            ? endpoint.replace(/\/api\/ingest$/, "/api/backfill")
            : endpoint,
          request,
        );
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
    trackPageview: (options = {}) =>
      post([{ eventType: "$pageview", properties: options.properties ?? {} }]),
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
