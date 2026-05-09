export { DEFAULT_CLICK_SELECTORS, enableClickAutotracking, } from "./autotrack";
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
    return {
        send: (event, options) => post([event], options),
        sendBatch: (events, options) => post(events, options),
    };
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
        properties: event.properties ?? {},
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
//# sourceMappingURL=index.js.map