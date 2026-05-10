import { trackPageview as sendPageview } from "./autotrack";
export { DEFAULT_CLICK_SELECTORS, enableClickAutotracking, trackPageview, } from "./autotrack";
export function createClient(config) {
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
    async function post(events, options) {
        if (events.length === 0) {
            return;
        }
        const request = {
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
    const client = {
        send: (event, options) => post([event], options),
        sendBatch: (events, options) => post(events, options),
        trackPageview: (options = {}) => sendPageview({ ...options, client }),
    };
    if (config.autoTrackPageviews !== false) {
        scheduleInitialPageview(client, config.onError);
    }
    return client;
}
function buildEndpoint(config) {
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
function joinPath(base, suffix) {
    return `${base.replace(/\/+$/, "")}${suffix}`;
}
function serializeEvent(event) {
    if (!event.eventType) {
        throw new Error("eventType is required");
    }
    return {
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
function serializeTimestamp(timestamp) {
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
function scheduleInitialPageview(client, onError) {
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
function collectClientContext() {
    const nav = globalThis.navigator;
    const win = globalThis.window;
    const doc = globalThis.document;
    const ua = nav?.userAgent ?? "";
    const uaData = nav?.userAgentData;
    const browser = parseBrowser(ua, uaData);
    const os = parseOperatingSystem(ua, uaData);
    const device = parseDevice(ua, uaData);
    const properties = {};
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
function parseBrowser(userAgent, uaData) {
    const brand = uaData?.brands?.find((candidate) => !candidate.brand.includes("Not"))?.brand;
    const candidates = [
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
        const version = uaData?.brands?.find((candidate) => candidate.brand === brand)?.version;
        return withVersion(brand, version);
    }
    return {};
}
function parseOperatingSystem(userAgent, uaData) {
    const platform = uaData?.platform;
    const normalizedPlatform = platform?.toLowerCase();
    if (normalizedPlatform?.includes("windows") || userAgent.includes("Windows")) {
        return withVersion("Windows", firstMatch(userAgent, /Windows NT ([0-9.]+)/));
    }
    if (normalizedPlatform?.includes("android") || userAgent.includes("Android")) {
        return withVersion("Android", firstMatch(userAgent, /Android ([0-9.]+)/));
    }
    if (/iPhone|iPad|iPod/.test(userAgent)) {
        return withVersion("iOS", firstMatch(userAgent, /OS ([0-9_]+)/)?.replace(/_/g, "."));
    }
    if (normalizedPlatform?.includes("mac") || userAgent.includes("Mac OS X")) {
        return withVersion("macOS", firstMatch(userAgent, /Mac OS X ([0-9_]+)/)?.replace(/_/g, "."));
    }
    if (userAgent.includes("CrOS")) {
        return withVersion("Chrome OS", firstMatch(userAgent, /CrOS [^ ]+ ([0-9.]+)/));
    }
    if (normalizedPlatform?.includes("linux") || userAgent.includes("Linux")) {
        return { name: "Linux" };
    }
    return platform ? { name: platform } : {};
}
function parseDevice(userAgent, uaData) {
    if (/bot|crawler|spider|crawling/i.test(userAgent)) {
        return { type: "bot" };
    }
    const model = firstMatch(userAgent, /\b(iPhone|iPad|iPod)\b/) ??
        firstMatch(userAgent, /\b(Pixel [^;)]+)/) ??
        firstMatch(userAgent, /\b(SM-[A-Z0-9]+)\b/) ??
        firstMatch(userAgent, /Android [^;]+;\s*([^;)]+)\)/);
    if (/iPad|Tablet|PlayBook|Silk/i.test(userAgent) || /Android(?!.*Mobile)/i.test(userAgent)) {
        return withModel("tablet", model);
    }
    if (uaData?.mobile || /Mobi|iPhone|iPod|Android.*Mobile/i.test(userAgent)) {
        return withModel("mobile", model);
    }
    return withModel("desktop", model);
}
function firstMatch(value, pattern) {
    return value.match(pattern)?.[1];
}
function withVersion(name, version) {
    return version ? { name, version } : { name };
}
function withModel(type, model) {
    return model ? { type, model } : { type };
}
function getTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
    catch {
        return undefined;
    }
}
function setProperty(properties, key, value) {
    if (value !== undefined && value !== "") {
        properties[key] = value;
    }
}
//# sourceMappingURL=index.js.map