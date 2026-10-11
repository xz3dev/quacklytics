import { z } from "zod";
import {
  sdkEvent,
  sdkOperation,
  sdkRequest,
  identifyOperation,
  ingestAcknowledgment,
  jsonProperties,
  type SdkEvent,
  type SdkOperation,
} from "./protocol.js";
import { context, observeNavigation, sanitizeUrl } from "./context.js";
import { enableClickAutotracking } from "./autotrack.js";
import { createClient as createLegacyClient } from "./legacy.js";
export type { EventProperties, JsonValue } from "./protocol.js";
import type { EventProperties } from "./protocol.js";
export {
  enableClickAutotracking,
  trackPageview,
  DEFAULT_CLICK_SELECTORS,
} from "./autotrack.js";
export type {
  ClickAutotrackOptions,
  ClickAutotrackHandle,
  TrackPageviewOptions,
} from "./autotrack.js";
export type { AnalyticsEvent, SendOptions } from "./legacy.js";
import type { AnalyticsEvent, SendOptions } from "./legacy.js";

export type ConsentState = "pending" | "granted" | "denied";
export type CaptureResult =
  | { status: "queued" | "buffered"; id: string }
  | { status: "disabled" | "dropped" };
export interface AnalyticsClientConfig {
  apiKey: string;
  hostname: string;
  port?: number;
  protocol?: "http" | "https";
  fetch?: typeof fetch;
  runtime?: "browser" | "server";
  consent?: "required" | "granted";
  autoTrackPageviews?: boolean;
  autocapture?: boolean;
  allowedQueryParameters?: readonly string[];
  sessionTimeoutMs?: number;
  flushIntervalMs?: number;
  batchSize?: number;
  maxQueueSize?: number;
  maxQueueBytes?: number;
  maxEventBytes?: number;
  maxQueueAgeMs?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  requestTimeoutMs?: number;
  beforeSend?: (event: SdkEvent) => SdkEvent | null;
  onError?: (error: unknown) => void;
}
export interface CaptureOptions {
  userId?: string;
  sessionId?: string;
  timestamp?: Date | string | number;
  id?: string;
}
export interface AnalyticsClient<
  Events extends { [Name in keyof Events]: EventProperties } = Record<
    string,
    EventProperties
  >,
> {
  track<Name extends Extract<keyof Events, string>>(
    name: Name,
    ...args: EventProperties extends Events[Name]
      ? [properties?: Events[Name], options?: CaptureOptions]
      : [properties: Events[Name], options?: CaptureOptions]
  ): Promise<CaptureResult>;
  page(properties?: EventProperties): Promise<CaptureResult>;
  identify(userId: string, traits?: EventProperties): Promise<CaptureResult>;
  reset(): void;
  setConsent(state: "granted" | "denied"): void;
  getConsent(): ConsentState;
  flush(): Promise<void>;
  destroy(): Promise<void>;
  send(event: AnalyticsEvent, options?: SendOptions): Promise<void>;
  sendBatch(
    events: readonly AnalyticsEvent[],
    options?: SendOptions,
  ): Promise<void>;
  trackPageview(options?: { properties?: EventProperties }): Promise<void>;
}
const savedIdentity = z.object({
  anonymousId: z.uuid(),
  sessionId: z.uuid(),
  userId: z.string().optional(),
  lastActivity: z.number(),
});
const savedBatch = z.object({ body: z.string(), createdAt: z.number() });
const savedQueue = z.object({
  pending: z.array(sdkOperation),
  batches: z.array(savedBatch),
});
// Captured before a consent decision; identity is attached once the visitor decides.
const bufferedOperation = z.discriminatedUnion("kind", [
  sdkEvent,
  identifyOperation.omit({ anonymousId: true }),
]);
const savedBuffer = z.array(bufferedOperation);
type BufferedOperation = z.infer<typeof bufferedOperation>;
type Identity = z.infer<typeof savedIdentity>;
type Batch = z.infer<typeof savedBatch>;
const instances = new Map<string, AnalyticsClient>();
const bytes = (value: string) => new TextEncoder().encode(value).byteLength;

export function createClient<
  Events extends { [Name in keyof Events]: EventProperties } = Record<
    string,
    EventProperties
  >,
>(config: AnalyticsClientConfig): AnalyticsClient<Events> {
  if (!config.apiKey) throw new Error("apiKey is required");
  if (!config.hostname) throw new Error("hostname is required");
  const url = new URL(
    config.hostname.includes("://")
      ? config.hostname
      : `${config.protocol ?? "https"}://${config.hostname}`,
  );
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("hostname must be an HTTP(S) URL without credentials");
  if (config.port !== undefined) url.port = String(config.port);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/ingest`;
  url.search = "";
  url.hash = "";
  const endpoint = url.toString();
  const browser = config.runtime !== "server" && typeof window !== "undefined";
  const key = `ql:${endpoint}:${config.apiKey}`;
  // A second initialization must not install another set of automatic collectors.
  if (browser && instances.has(key))
    throw new Error(
      "Quacklytics is already initialized for this project; reuse the existing client",
    );
  const numberOption = (
    value: number | undefined,
    fallback: number,
    max = Number.MAX_SAFE_INTEGER,
  ) =>
    z
      .number()
      .int()
      .positive()
      .max(max)
      .parse(value ?? fallback);
  const batchSize = numberOption(config.batchSize, 20, 1000);
  const maxQueueSize = numberOption(config.maxQueueSize, 1000);
  const maxQueueBytes = numberOption(config.maxQueueBytes, 1_000_000);
  const maxEventBytes = numberOption(config.maxEventBytes, 48_000, 48_000);
  const maxAge = numberOption(config.maxQueueAgeMs, 24 * 60 * 60 * 1000);
  const sessionTimeout = numberOption(config.sessionTimeoutMs, 30 * 60 * 1000);
  const intervalMs = numberOption(config.flushIntervalMs, 5000);
  const attempts = numberOption(config.maxAttempts, 3, 10);
  const retryDelay = numberOption(config.retryDelayMs, 250);
  const timeoutMs = numberOption(config.requestTimeoutMs, 10000);
  const transport = config.fetch ?? globalThis.fetch;
  if (!transport) throw new Error("fetch is unavailable");
  const legacy = createLegacyClient({
    ...config,
    protocol: config.protocol ?? "https",
    autoTrackPageviews: false,
  });
  const allowed = config.allowedQueryParameters ?? [];
  let dead = false,
    generation = 0;
  let identity: Identity | undefined;
  let identityMemoryOnly = false;
  let pending: SdkOperation[] = [],
    batches: Batch[] = [];
  let running: Promise<void> | undefined;
  let controller: AbortController | undefined;
  let retryWake: (() => void) | undefined;
  let pageUrl: string | undefined, pageViewId: string | undefined;
  const report = (error: unknown) => {
    try {
      config.onError?.(error);
    } catch {
      /* Application error handlers cannot break collection. */
    }
  };
  function storageRead(name: string, tab = false): string | null {
    if (!browser) return null;
    try {
      return (tab ? sessionStorage : localStorage).getItem(`${key}:${name}`);
    } catch {
      return null;
    }
  }
  function storageWrite(name: string, value: string | null, tab = false) {
    if (!browser) return false;
    try {
      const storage = tab ? sessionStorage : localStorage;
      if (value === null) storage.removeItem(`${key}:${name}`);
      else storage.setItem(`${key}:${name}`, value);
      return true;
    } catch (error) {
      report(error);
      return false;
    }
  }
  function readIdentity(): Identity | undefined {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(`${key}:identity`) ?? "null",
      );
      const parsed = savedIdentity.safeParse(value);
      return parsed.success
        ? parsed.data
        : identityMemoryOnly
          ? identity
          : undefined;
    } catch {
      return identity;
    }
  }
  let consent: ConsentState = !browser
    ? "granted"
    : storageRead("consent") === "denied"
      ? "denied"
      : storageRead("consent") === "granted" || config.consent === "granted"
        ? "granted"
        : "pending";
  if (consent === "denied") {
    storageWrite("identity", null);
    storageWrite("outbox", null, true);
  }
  let bufferInMemory = false,
    memoryBuffer: BufferedOperation[] = [];
  /** Full collection: persistent visitor identity, identify, and a stored outbox. */
  function active() {
    if (browser && consent === "granted" && storageRead("consent") === "denied")
      setConsent("denied", false);
    return !dead && consent === "granted";
  }
  /** Declined collection: the service assigns a cookieless daily visitor; nothing is stored. */
  function anonymous() {
    return !active() && !dead && consent === "denied";
  }
  function sending() {
    return active() || anonymous();
  }
  function readBuffer(): BufferedOperation[] {
    if (bufferInMemory) return memoryBuffer;
    try {
      const parsed = savedBuffer.safeParse(
        JSON.parse(storageRead("buffer") ?? "[]"),
      );
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }
  function writeBuffer(entries: BufferedOperation[]) {
    memoryBuffer = entries;
    if (!bufferInMemory)
      bufferInMemory = !storageWrite(
        "buffer",
        entries.length ? JSON.stringify(entries) : null,
      );
  }
  function buffer(operation: BufferedOperation): CaptureResult {
    const snapshot = bufferedOperation.parse(
      JSON.parse(JSON.stringify(operation)),
    );
    if (bytes(JSON.stringify(snapshot)) > maxEventBytes)
      throw new Error("Analytics event exceeds maxEventBytes");
    const entries = [
      ...readBuffer().filter(
        (entry) => Date.now() - Date.parse(entry.timestamp) <= maxAge,
      ),
      snapshot,
    ];
    if (
      entries.length > maxQueueSize ||
      bytes(JSON.stringify(entries)) > maxQueueBytes
    )
      throw new Error("Analytics consent buffer is full");
    writeBuffer(entries);
    return { status: "buffered", id: snapshot.id };
  }
  /** Sends pre-consent captures under the identity the visitor's decision allows. */
  function release() {
    const entries = readBuffer().filter(
      (entry) => Date.now() - Date.parse(entry.timestamp) <= maxAge,
    );
    if (!entries.length || !sending()) return;
    writeBuffer([]);
    const full = active();
    for (const entry of entries) {
      try {
        const who = full ? currentIdentity() : undefined;
        if (entry.kind === "identify") {
          // Declining consent never sends person data.
          if (!who) continue;
          if (who.userId && who.userId !== entry.userId)
            throw new Error("Reset before switching users");
          enqueue(
            sdkOperation.parse({ ...entry, anonymousId: who.anonymousId }),
          );
        } else
          enqueue(
            sdkOperation.parse({
              ...entry,
              ...(who
                ? { anonymousId: who.anonymousId, sessionId: who.sessionId }
                : { anonymous: true }),
            }),
          );
      } catch (error) {
        report(error);
      }
    }
    void flush().catch(report);
  }
  function currentIdentity(): Identity | undefined {
    if (!browser) return undefined;
    identity = readIdentity();
    const now = Date.now();
    identity ??= {
      anonymousId: crypto.randomUUID(),
      sessionId: crypto.randomUUID(),
      lastActivity: now,
    };
    if (
      now - identity.lastActivity >= sessionTimeout ||
      now < identity.lastActivity
    )
      identity.sessionId = crypto.randomUUID();
    identity.lastActivity = now;
    identityMemoryOnly = !storageWrite("identity", JSON.stringify(identity));
    return identity;
  }
  function persist() {
    if (active())
      storageWrite("outbox", JSON.stringify({ pending, batches }), true);
  }
  function prune() {
    const before = pending.length + batches.length;
    pending = pending.filter(
      (operation) => Date.now() - Date.parse(operation.timestamp) <= maxAge,
    );
    batches = batches.filter((batch) => Date.now() - batch.createdAt <= maxAge);
    if (before !== pending.length + batches.length)
      report(new Error("Expired analytics outbox entries were dropped"));
  }
  if (active() && browser) {
    try {
      const raw: unknown = JSON.parse(storageRead("outbox", true) ?? "null");
      const restored = savedQueue.safeParse(raw);
      if (restored.success) {
        // Validate serialized envelopes as well; storage is an external input.
        for (const batch of restored.data.batches)
          sdkRequest.parse(JSON.parse(batch.body));
        const count =
          restored.data.pending.length +
          restored.data.batches.reduce(
            (sum, batch) =>
              sum + sdkRequest.parse(JSON.parse(batch.body)).operations.length,
            0,
          );
        if (
          count <= maxQueueSize &&
          bytes(JSON.stringify(restored.data)) <= maxQueueBytes
        ) {
          pending = restored.data.pending;
          batches = restored.data.batches;
          prune();
        }
      }
    } catch (error) {
      report(error);
      storageWrite("outbox", null, true);
    }
  }
  function enqueue(operation: SdkOperation): CaptureResult {
    if (!sending()) return { status: "disabled" };
    prune();
    const snapshot = sdkOperation.parse(JSON.parse(JSON.stringify(operation)));
    const serialized = JSON.stringify(snapshot);
    if (bytes(serialized) > maxEventBytes)
      throw new Error("Analytics event exceeds maxEventBytes");
    const queued =
      pending.length +
      batches.reduce(
        (sum, batch) =>
          sum + sdkRequest.parse(JSON.parse(batch.body)).operations.length,
        0,
      );
    if (
      queued >= maxQueueSize ||
      bytes(JSON.stringify({ pending: [...pending, snapshot], batches })) >
        maxQueueBytes
    )
      throw new Error("Analytics outbox is full");
    pending.push(snapshot);
    persist();
    if (pending.length >= batchSize)
      queueMicrotask(() => {
        void flush().catch(report);
      });
    return { status: "queued", id: operation.id };
  }
  function capture(
    name: string,
    properties: EventProperties,
    extra: Partial<SdkEvent> = {},
  ): CaptureResult {
    const undecided = browser && !dead && consent === "pending";
    if (!undecided && !sending()) return { status: "disabled" };
    const timestamp = extra.timestamp ?? new Date().toISOString();
    const who = active() ? currentIdentity() : undefined;
    const capturedContext = context(allowed, browser);
    if (capturedContext.page && pageViewId)
      capturedContext.page.pageViewId = pageViewId;
    const event = sdkEvent.parse({
      kind: "event",
      id: crypto.randomUUID(),
      timestamp,
      eventType: name,
      ...(who
        ? {
            anonymousId: who.anonymousId,
            sessionId: who.sessionId,
            ...(who.userId ? { userId: who.userId } : {}),
          }
        : anonymous() && browser
          ? { anonymous: true }
          : {}),
      properties: jsonProperties.parse(properties),
      context: capturedContext,
      ...extra,
    });
    const transformed = config.beforeSend ? config.beforeSend(event) : event;
    if (transformed === null) return { status: "dropped" };
    // Hooks may redact content, but cannot rewrite identity, timestamps, or idempotency keys.
    const final = sdkEvent.parse({
      ...transformed,
      id: event.id,
      timestamp: event.timestamp,
      anonymousId: event.anonymousId,
      sessionId: event.sessionId,
      userId: event.userId,
      anonymous: event.anonymous,
    });
    return undecided ? buffer(final) : enqueue(final);
  }
  async function page(
    properties: EventProperties = {},
  ): Promise<CaptureResult> {
    if (dead || !browser) return { status: "disabled" };
    const nextUrl = sanitizeUrl(location.href, allowed);
    if (pageUrl === nextUrl) return { status: "dropped" };
    const previous = pageUrl;
    const nextId = crypto.randomUUID();
    const capturedContext = context(allowed, browser);
    if (capturedContext.page)
      capturedContext.page = {
        ...capturedContext.page,
        pageViewId: nextId,
        ...(previous ? { previousUrl: previous } : {}),
      };
    const result = capture("$pageview", properties, {
      context: capturedContext,
    });
    if (result.status === "queued" || result.status === "buffered") {
      pageUrl = nextUrl;
      pageViewId = nextId;
    }
    return result;
  }
  function makeBatch(): Batch | undefined {
    if (batches[0]) return batches[0];
    if (!pending.length) return undefined;
    const operations: SdkOperation[] = [];
    const requestId = crypto.randomUUID();
    while (pending[0] && operations.length < batchSize) {
      const next = pending[0];
      if (
        operations.length &&
        bytes(
          JSON.stringify({
            protocolVersion: 1,
            requestId,
            operations: [...operations, next],
          }),
        ) > 55_000
      )
        break;
      operations.push(next);
      pending.shift();
    }
    const batch = {
      body: JSON.stringify(
        sdkRequest.parse({ protocolVersion: 1, requestId, operations }),
      ),
      createdAt: Date.now(),
    };
    batches.push(batch);
    persist();
    return batch;
  }
  async function deliver(batch: Batch, epoch: number) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (!sending() || epoch !== generation)
        throw new Error("Analytics delivery cancelled");
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), timeoutMs);
      let delay = retryDelay * 2 ** attempt * (0.75 + Math.random() * 0.5);
      try {
        const response = await transport(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-KEY": config.apiKey,
          },
          body: batch.body,
          signal: controller.signal,
          keepalive: browser,
        });
        if (response.ok) {
          const acknowledgment = ingestAcknowledgment.parse(
            await response.json(),
          );
          if (
            acknowledgment.committed +
              acknowledgment.duplicates +
              acknowledgment.rejected !==
            sdkRequest.parse(JSON.parse(batch.body)).operations.length
          )
            throw new Error("Invalid analytics acknowledgment count");
          return;
        }
        if (response.status !== 429 && response.status < 500) {
          if (batches[0] === batch) batches.shift();
          persist();
          throw new PermanentDeliveryError(
            `Analytics rejected (${response.status}): ${await response.text()}`,
          );
        }
        const retryAfter = response.headers.get("Retry-After");
        if (retryAfter) {
          const seconds = Number(retryAfter);
          const requestedDelay = Number.isFinite(seconds)
            ? seconds * 1000
            : Date.parse(retryAfter) - Date.now();
          if (Number.isFinite(requestedDelay))
            delay = Math.min(60_000, Math.max(delay, requestedDelay));
        }
        if (attempt === attempts - 1)
          throw new Error(
            `Analytics unavailable (${response.status}); retained for retry`,
          );
      } catch (error) {
        if (
          error instanceof PermanentDeliveryError ||
          attempt === attempts - 1 ||
          !sending() ||
          epoch !== generation
        )
          throw error;
      } finally {
        clearTimeout(timeout);
      }
      if (attempt < attempts - 1)
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            retryWake = undefined;
            resolve();
          }, delay);
          retryWake = () => {
            clearTimeout(timer);
            retryWake = undefined;
            resolve();
          };
        });
    }
  }
  async function drain() {
    const epoch = generation;
    prune();
    while (sending() && epoch === generation) {
      const batch = makeBatch();
      if (!batch) return;
      await deliver(batch, epoch);
      if (!sending() || epoch !== generation) return;
      for (const operation of sdkRequest.parse(JSON.parse(batch.body))
        .operations) {
        if (operation.kind === "identify" && browser && active()) {
          const who = currentIdentity();
          if (who?.anonymousId === operation.anonymousId) {
            who.userId = operation.userId;
            identity = who;
            identityMemoryOnly = !storageWrite("identity", JSON.stringify(who));
          }
        }
      }
      if (batches[0] === batch) batches.shift();
      persist();
    }
  }
  function flush(): Promise<void> {
    if (!running)
      running = drain().finally(() => {
        running = undefined;
      });
    // A caller may enqueue in the microtask between the drain ending and its
    // promise settling. Its flush must also acknowledge that newly queued work.
    return running.then(() => {
      if (sending() && (pending.length || batches.length)) return flush();
    });
  }
  function clearDelivery() {
    generation++;
    controller?.abort();
    retryWake?.();
    pending = [];
    batches = [];
    storageWrite("outbox", null, true);
  }
  function setConsent(state: "granted" | "denied", save = true) {
    if (dead) return;
    const previous = consent;
    consent = state;
    if (save) storageWrite("consent", state);
    if (state === "denied") {
      clearDelivery();
      identity = undefined;
      storageWrite("identity", null);
    }
    // Pre-consent pageviews are released below; a new identity needs its own pageview.
    if (previous !== "pending" && previous !== state) {
      pageUrl = undefined;
      pageViewId = undefined;
    }
    release();
    if (previous !== state && config.autoTrackPageviews !== false)
      void page().catch(report);
  }
  function track(
    name: string,
    properties: EventProperties = {},
    options: CaptureOptions = {},
  ) {
    if (browser && (options.userId || options.sessionId))
      throw new Error("Use identify/reset for browser identity");
    return capture(name, properties, {
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.sessionId ? { sessionId: options.sessionId } : {}),
      ...(options.id ? { id: options.id } : {}),
      ...(options.timestamp !== undefined
        ? { timestamp: new Date(options.timestamp).toISOString() }
        : {}),
    });
  }
  const cleanups: Array<() => void> = [];
  const client: AnalyticsClient<Events> = {
    track: async (name, ...args) => track(name, args[0], args[1]),
    page,
    async identify(userId, traits = {}) {
      if (browser && !dead && consent === "pending")
        return buffer({
          kind: "identify",
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          userId,
          traits,
        });
      if (!active()) return { status: "disabled" };
      const who = currentIdentity();
      if (!who)
        throw new Error(
          "Server events must supply userId explicitly; identify requires a browser visitor",
        );
      if (who.userId && who.userId !== userId)
        throw new Error("Reset before switching users");
      const result = enqueue(
        sdkOperation.parse({
          kind: "identify",
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          anonymousId: who.anonymousId,
          userId,
          traits,
        }),
      );
      await flush();
      return result;
    },
    reset() {
      if (!active()) return;
      identity = undefined;
      storageWrite("identity", null);
      pageUrl = undefined;
      pageViewId = undefined;
    },
    setConsent,
    getConsent: () => consent,
    flush,
    async destroy() {
      if (dead) return;
      dead = true;
      generation++;
      controller?.abort();
      retryWake?.();
      for (const cleanup of cleanups) cleanup();
      if (browser) instances.delete(key);
      await running?.catch(report);
    },
    async send(event, options) {
      await client.sendBatch([event], options);
    },
    async sendBatch(events, options) {
      if (dead) return;
      if (!browser) {
        await legacy.sendBatch(events, options);
        return;
      }
      if (options?.signal)
        throw new Error(
          "AbortSignal is supported only by the server batch importer",
        );
      if (options?.deferExport || options?.backfill)
        throw new Error(
          "deferExport and backfill are supported only by the server batch importer",
        );
      for (const event of events) {
        if (event.personId || event.sessionId)
          throw new Error("Use identify/reset for browser identity");
        jsonProperties.parse(event.properties ?? {});
        if (
          event.personProperties &&
          Object.keys(event.personProperties).length
        )
          throw new Error(
            "Use identify(userId, traits) to update browser person properties",
          );
      }
      for (const event of events)
        capture(event.eventType, event.properties ?? {}, {
          ...(event.id ? { id: event.id } : {}),
          ...(event.timestamp !== undefined
            ? { timestamp: new Date(event.timestamp).toISOString() }
            : {}),
          ...(event.sessionId ? { sessionId: event.sessionId } : {}),
          ...(event.personId ? { userId: event.personId } : {}),
        });
      await flush();
    },
    async trackPageview(options = {}) {
      await page(options.properties);
      await flush();
    },
  };
  if (browser) {
    // Store only the lifecycle surface; generic event maps remain local to callers.
    instances.set(key, {
      ...client,
      track: async (name, ...args) => track(name, args[0], args[1]),
    });
    if (config.autoTrackPageviews !== false) {
      const initial = () => {
        void page().catch(report);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initial, { once: true });
        cleanups.push(() =>
          document.removeEventListener("DOMContentLoaded", initial),
        );
      } else queueMicrotask(initial);
      cleanups.push(observeNavigation(() => queueMicrotask(initial)));
    }
    if (config.autocapture)
      cleanups.push(
        enableClickAutotracking({
          client: {
            track: async (name, ...args) => track(name, args[0], args[1]),
          },
          onError: report,
          enabled: () => !dead,
        }).stop,
      );
    const visibility = () => {
      if (document.visibilityState === "hidden") void flush().catch(report);
    };
    const pagehide = () => {
      void flush().catch(report);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === `${key}:consent`) {
        // Storage events may be delayed; never replay an older decision over the current one.
        const next =
          storageRead("consent") === "granted" ? "granted" : "denied";
        if (consent !== next) setConsent(next, false);
      }
      if (event.key === `${key}:identity`) {
        const previous = identity?.anonymousId;
        identity = readIdentity();
        if (previous !== identity?.anonymousId) {
          pageUrl = undefined;
          pageViewId = undefined;
        }
      }
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", pagehide);
    window.addEventListener("storage", storage);
    const timer = setInterval(() => {
      if (sending()) void flush().catch(report);
    }, intervalMs);
    // Another tab may have decided while this one was closed, or config granted consent.
    if (consent !== "pending") release();
    cleanups.push(() => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", pagehide);
      window.removeEventListener("storage", storage);
    });
  }
  return client;
}
class PermanentDeliveryError extends Error {}
