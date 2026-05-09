import { jsx as _jsx, jsxs as _jsxs } from "preact/jsx-runtime";
import { render } from "preact";
const DEFAULT_BANNER_HTML = "We use lightweight analytics to understand which parts of this site are useful. Accept to include a persistent visitor id, or continue with session-only analytics.";
export function createCookieConsent(options) {
    const doc = options.document ?? globalThis.document;
    const enabled = options.enabled ?? true;
    const cookiePrefix = options.cookiePrefix ?? "ql";
    const persistentDays = options.persistentDays ?? 365;
    const pending = [];
    let currentDecision = enabled ? readDecision(doc, cookiePrefix) : "accepted";
    let bannerHandle;
    const consentClient = {
        send(event) {
            return sendEvents([event]);
        },
        sendBatch(events) {
            return sendEvents(events);
        },
    };
    function sendEvents(events) {
        if (!enabled || currentDecision) {
            return sendResolved(events);
        }
        return new Promise((resolve, reject) => {
            pending.push({ events, resolve, reject });
        });
    }
    function sendResolved(events) {
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
    function decide(decision) {
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
    function showBanner(optionsOverride) {
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
function renderCookieBanner(doc, options) {
    const container = doc.createElement("div");
    container.setAttribute("data-quacklytics-cookie-banner", "");
    doc.body.appendChild(container);
    const close = () => {
        render(null, container);
        container.remove();
    };
    render(_jsx(CookieBanner, { textHtml: options.textHtml ?? DEFAULT_BANNER_HTML, acceptLabel: options.acceptLabel ?? "Accept", rejectLabel: options.rejectLabel ?? "Session only", onAccept: options.onAccept, onReject: options.onReject }), container);
    return { close };
}
function CookieBanner(props) {
    return (_jsxs("div", { style: styles.shell, role: "dialog", "aria-live": "polite", "aria-label": "Analytics consent", children: [_jsx("div", { style: styles.text, dangerouslySetInnerHTML: { __html: props.textHtml } }), _jsxs("div", { style: styles.actions, children: [_jsx("button", { type: "button", style: styles.secondaryButton, onClick: props.onReject, children: props.rejectLabel }), _jsx("button", { type: "button", style: styles.primaryButton, onClick: props.onAccept, children: props.acceptLabel })] })] }));
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
};
function ensureIdentity(doc, options) {
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
function applyIdentity(event, identity, decision) {
    return {
        ...event,
        sessionId: event.sessionId ?? identity.sessionId,
        ...(decision === "accepted" ? { personId: event.personId ?? identity.personId } : {}),
        properties: {
            ...(event.properties ?? {}),
            trackingConsent: decision,
        },
    };
}
function readDecision(doc, cookiePrefix) {
    const value = readCookie(doc, `${cookiePrefix}_consent`);
    return value === "accepted" || value === "rejected" ? value : undefined;
}
function writeDecision(doc, cookiePrefix, decision, domain, persistentDays) {
    writeCookie(doc, `${cookiePrefix}_consent`, decision, {
        domain,
        maxAgeDays: persistentDays,
    });
}
function readCookie(doc, name) {
    if (!doc) {
        return undefined;
    }
    const match = doc.cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${encodeURIComponent(name)}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}
function writeCookie(doc, name, value, options) {
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
function clearCookie(doc, name, domain) {
    if (!doc) {
        return;
    }
    const parts = [`${encodeURIComponent(name)}=`, "Path=/", "Max-Age=0"];
    if (domain) {
        parts.push(`Domain=${domain}`);
    }
    doc.cookie = parts.join("; ");
}
function createId() {
    const crypto = globalThis.crypto;
    if (crypto?.randomUUID) {
        return crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (crypto?.getRandomValues) {
        crypto.getRandomValues(bytes);
    }
    else {
        for (let i = 0; i < bytes.length; i += 1) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
//# sourceMappingURL=consent.js.map