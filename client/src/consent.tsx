import { render } from "preact";
import type { JSX } from "preact";
import type { AnalyticsClient, AnalyticsEvent, EventProperties } from "./index";

export type ConsentDecision = "accepted" | "rejected";

export interface CookieConsentOptions {
  client: Pick<AnalyticsClient, "send" | "sendBatch">;
  enabled?: boolean;
  document?: Document;
  cookieDomain?: string;
  cookiePrefix?: string;
  persistentDays?: number;
  banner?: CookieBannerOptions;
  onError?: (error: unknown) => void;
}

export interface CookieBannerOptions {
  textHtml?: string;
  acceptLabel?: string;
  rejectLabel?: string;
}

export interface CookieConsentController {
  client: AnalyticsClient;
  decision(): ConsentDecision | undefined;
  accept(): void;
  reject(): void;
  reset(): void;
  showBanner(options?: CookieBannerOptions): CookieBannerHandle | undefined;
}

export interface CookieBannerHandle {
  close(): void;
}

interface PendingSend {
  events: readonly AnalyticsEvent[];
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface Identity {
  sessionId: string;
  personId?: string;
}

const DEFAULT_BANNER_HTML =
  "We use lightweight analytics to understand which parts of this site are useful. Accept to include a persistent visitor id, or continue with session-only analytics.";

export function createCookieConsent(options: CookieConsentOptions): CookieConsentController {
  const doc = options.document ?? globalThis.document;
  const enabled = options.enabled ?? true;
  const cookiePrefix = options.cookiePrefix ?? "ql";
  const persistentDays = options.persistentDays ?? 365;
  const pending: PendingSend[] = [];

  let currentDecision = enabled ? readDecision(doc, cookiePrefix) : "accepted";
  let bannerHandle: CookieBannerHandle | undefined;

  const consentClient: AnalyticsClient = {
    send(event) {
      return sendEvents([event]);
    },
    sendBatch(events) {
      return sendEvents(events);
    },
  };

  function sendEvents(events: readonly AnalyticsEvent[]): Promise<void> {
    if (!enabled || currentDecision) {
      return sendResolved(events);
    }

    return new Promise((resolve, reject) => {
      pending.push({ events, resolve, reject });
    });
  }

  function sendResolved(events: readonly AnalyticsEvent[]): Promise<void> {
    const decision = currentDecision ?? "accepted";
    const identity = ensureIdentity(doc, {
      accepted: decision === "accepted",
      cookiePrefix,
      cookieDomain: options.cookieDomain,
      persistentDays,
    });
    const withIdentity = events.map((event) => applyIdentity(event, identity, decision));
    return options.client.sendBatch(withIdentity).catch((error) => {
      options.onError?.(error);
      throw error;
    });
  }

  function decide(decision: ConsentDecision) {
    currentDecision = decision;
    writeDecision(doc, cookiePrefix, decision, options.cookieDomain, persistentDays);
    ensureIdentity(doc, {
      accepted: decision === "accepted",
      cookiePrefix,
      cookieDomain: options.cookieDomain,
      persistentDays,
    });
    flushPending();
    bannerHandle?.close();
    bannerHandle = undefined;
  }

  function flushPending() {
    const batch = pending.splice(0, pending.length);
    for (const pendingSend of batch) {
      sendResolved(pendingSend.events).then(pendingSend.resolve, pendingSend.reject);
    }
  }

  function showBanner(optionsOverride?: CookieBannerOptions): CookieBannerHandle | undefined {
    if (!enabled || currentDecision || !doc) {
      return undefined;
    }
    bannerHandle?.close();
    bannerHandle = renderCookieBanner(doc, {
      ...options.banner,
      ...optionsOverride,
      onAccept: () => decide("accepted"),
      onReject: () => decide("rejected"),
    });
    return bannerHandle;
  }

  if (!enabled || currentDecision) {
    ensureIdentity(doc, {
      accepted: currentDecision !== "rejected",
      cookiePrefix,
      cookieDomain: options.cookieDomain,
      persistentDays,
    });
  }

  return {
    client: consentClient,
    decision: () => currentDecision,
    accept: () => decide("accepted"),
    reject: () => decide("rejected"),
    reset() {
      currentDecision = undefined;
      clearCookie(doc, `${cookiePrefix}_consent`, options.cookieDomain);
      clearCookie(doc, `${cookiePrefix}_person_id`, options.cookieDomain);
      clearCookie(doc, `${cookiePrefix}_session_id`, options.cookieDomain);
    },
    showBanner,
  };
}

interface RenderCookieBannerOptions extends CookieBannerOptions {
  onAccept: () => void;
  onReject: () => void;
}

function renderCookieBanner(doc: Document, options: RenderCookieBannerOptions): CookieBannerHandle {
  const container = doc.createElement("div");
  container.setAttribute("data-quacklytics-cookie-banner", "");
  doc.body.appendChild(container);

  const close = () => {
    render(null, container);
    container.remove();
  };

  render(
    <CookieBanner
      textHtml={options.textHtml ?? DEFAULT_BANNER_HTML}
      acceptLabel={options.acceptLabel ?? "Accept"}
      rejectLabel={options.rejectLabel ?? "Session only"}
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
  onAccept: () => void;
  onReject: () => void;
}

function CookieBanner(props: CookieBannerProps) {
  return (
    <div style={styles.shell} role="dialog" aria-live="polite" aria-label="Analytics consent">
      <div style={styles.text} dangerouslySetInnerHTML={{ __html: props.textHtml }} />
      <div style={styles.actions}>
        <button type="button" style={styles.secondaryButton} onClick={props.onReject}>
          {props.rejectLabel}
        </button>
        <button type="button" style={styles.primaryButton} onClick={props.onAccept}>
          {props.acceptLabel}
        </button>
      </div>
    </div>
  );
}

const styles = {
  shell: {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    width: "min(420px, calc(100vw - 32px))",
    boxSizing: "border-box",
    display: "grid",
    gap: "14px",
    padding: "16px",
    color: "#111827",
    background: "rgba(255, 255, 255, 0.96)",
    border: "1px solid rgba(17, 24, 39, 0.16)",
    borderRadius: "8px",
    boxShadow: "0 18px 60px rgba(17, 24, 39, 0.18)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: "13px",
    lineHeight: "1.45",
  },
  text: {
    margin: "0",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    flexWrap: "wrap",
  },
  primaryButton: {
    border: "1px solid #111827",
    borderRadius: "6px",
    padding: "8px 12px",
    background: "#111827",
    color: "#ffffff",
    font: "inherit",
    cursor: "pointer",
  },
  secondaryButton: {
    border: "1px solid rgba(17, 24, 39, 0.18)",
    borderRadius: "6px",
    padding: "8px 12px",
    background: "#ffffff",
    color: "#111827",
    font: "inherit",
    cursor: "pointer",
  },
} satisfies Record<string, JSX.CSSProperties>;

interface EnsureIdentityOptions {
  accepted: boolean;
  cookiePrefix: string;
  cookieDomain?: string | undefined;
  persistentDays: number;
}

function ensureIdentity(doc: Document | undefined, options: EnsureIdentityOptions): Identity {
  const sessionCookie = `${options.cookiePrefix}_session_id`;
  const personCookie = `${options.cookiePrefix}_person_id`;
  const sessionId = readCookie(doc, sessionCookie) ?? createId();

  if (!readCookie(doc, sessionCookie)) {
    writeCookie(doc, sessionCookie, sessionId, {
      domain: options.cookieDomain,
      maxAgeDays: options.accepted ? options.persistentDays : undefined,
    });
  }

  if (!options.accepted) {
    return { sessionId };
  }

  const personId = readCookie(doc, personCookie) ?? createId();
  if (!readCookie(doc, personCookie)) {
    writeCookie(doc, personCookie, personId, {
      domain: options.cookieDomain,
      maxAgeDays: options.persistentDays,
    });
  }
  writeCookie(doc, sessionCookie, sessionId, {
    domain: options.cookieDomain,
    maxAgeDays: options.persistentDays,
  });
  return { sessionId, personId };
}

function applyIdentity(event: AnalyticsEvent, identity: Identity, decision: ConsentDecision): AnalyticsEvent {
  return {
    ...event,
    sessionId: event.sessionId ?? identity.sessionId,
    ...(decision === "accepted" ? { personId: event.personId ?? identity.personId } : {}),
    properties: {
      ...(event.properties ?? {}),
      trackingConsent: decision,
    } satisfies EventProperties,
  };
}

function readDecision(doc: Document | undefined, cookiePrefix: string): ConsentDecision | undefined {
  const value = readCookie(doc, `${cookiePrefix}_consent`);
  return value === "accepted" || value === "rejected" ? value : undefined;
}

function writeDecision(
  doc: Document | undefined,
  cookiePrefix: string,
  decision: ConsentDecision,
  domain: string | undefined,
  persistentDays: number,
) {
  writeCookie(doc, `${cookiePrefix}_consent`, decision, {
    domain,
    maxAgeDays: persistentDays,
  });
}

function readCookie(doc: Document | undefined, name: string): string | undefined {
  if (!doc) {
    return undefined;
  }
  const match = doc.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${encodeURIComponent(name)}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

interface WriteCookieOptions {
  domain?: string | undefined;
  maxAgeDays?: number | undefined;
}

function writeCookie(doc: Document | undefined, name: string, value: string, options: WriteCookieOptions) {
  if (!doc) {
    return;
  }
  const parts = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "Path=/",
    "SameSite=Lax",
  ];
  if (options.maxAgeDays != null) {
    parts.push(`Max-Age=${Math.round(options.maxAgeDays * 24 * 60 * 60)}`);
  }
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (doc.location?.protocol === "https:") {
    parts.push("Secure");
  }
  doc.cookie = parts.join("; ");
}

function clearCookie(doc: Document | undefined, name: string, domain: string | undefined) {
  if (!doc) {
    return;
  }
  const parts = [`${encodeURIComponent(name)}=`, "Path=/", "Max-Age=0"];
  if (domain) {
    parts.push(`Domain=${domain}`);
  }
  doc.cookie = parts.join("; ");
}

function createId(): string {
  const crypto = globalThis.crypto;
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
