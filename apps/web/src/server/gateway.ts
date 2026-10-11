import type { BlockList } from "node:net";
import { resolve } from "node:path";
import { clientAddress, trustedProxies } from "./client-address";
import { createGeoip } from "./geoip";
import { workerResponse } from "./worker-protocol";

interface GatewayOptions {
  createWorker: () => Worker;
  maxOutstanding?: number;
  timeoutMs?: number;
  shutdownMs?: number;
  /** Proxies whose X-Forwarded-For entries identify the client. */
  trusted?: BlockList | undefined;
  /** ISO country code of a client address, if known. */
  country?: (address: string) => string | undefined;
}
export function createGateway({
  createWorker,
  maxOutstanding = 256,
  timeoutMs = 60000,
  shutdownMs = 15000,
  trusted,
  country,
}: GatewayOptions) {
  let worker: Worker | undefined;
  let reading = 0;
  let closing = false;
  let stopped = false;
  const pending = new Map<
    string,
    {
      resolve: (response: Response) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  function getWorker() {
    if (worker) return worker;
    const instance = createWorker();
    instance.onmessage = (event: MessageEvent<unknown>) => {
      if (worker !== instance) return;
      const message = workerResponse.parse(event.data);
      if (message.type === "shutdown") {
        stopped = true;
        return;
      }
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      clearTimeout(request.timer);
      request.resolve(
        new Response(message.status === 204 ? null : message.body, {
          status: message.status,
          headers: message.headers,
        }),
      );
    };
    instance.onerror = () => {
      if (worker !== instance) return;
      worker = undefined;
      for (const request of pending.values()) {
        clearTimeout(request.timer);
        request.reject(new Error("Backend worker stopped"));
      }
      pending.clear();
      instance.terminate();
    };
    worker = instance;
    return instance;
  }
  async function gateway(request: Request, socketAddress = "127.0.0.1") {
    // Timed-out HTTP requests still occupy a slot until the backend completes.
    // Include body readers so concurrent uploads cannot bypass the bound.
    if (closing || reading + pending.size >= maxOutstanding)
      return Response.json(
        { error: "Server busy; retry later" },
        {
          status: 503,
          headers: { "Retry-After": "1" },
        },
      );
    reading++;
    let admitted = false;
    try {
      const headers = new Headers(request.headers);
      const client = clientAddress(
        socketAddress,
        request.headers.get("x-forwarded-for"),
        trusted,
      );
      headers.set("x-quacklytics-socket-ip", socketAddress);
      headers.set("x-quacklytics-client-ip", client);
      // Never forward a country the client supplied itself.
      headers.delete("x-quacklytics-country");
      const code = country?.(client);
      if (code) headers.set("x-quacklytics-country", code);
      let body: string | undefined;
      if (!["GET", "HEAD"].includes(request.method)) {
        const reader = request.body?.getReader();
        let size = 0;
        const chunks: Uint8Array[] = [];
        if (reader) {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > 2_000_000) {
              await reader.cancel();
              return Response.json(
                { error: "Request too large" },
                { status: 413 },
              );
            }
            chunks.push(part.value);
          }
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        body = new TextDecoder().decode(bytes);
      }
      if (closing)
        return Response.json(
          { error: "Backend shutting down" },
          { status: 503 },
        );
      if (request.signal.aborted) return new Response(null, { status: 499 });
      const id = crypto.randomUUID();
      const backend = getWorker();
      const response = new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          // Do not release capacity or cancel a potentially committed mutation.
          resolve(
            Response.json(
              { error: "Request timed out; retry with the same event IDs" },
              { status: 504 },
            ),
          );
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        reading--;
        admitted = true;
        try {
          backend.postMessage({
            type: "request",
            id,
            url: request.url,
            method: request.method,
            headers: [...headers],
            ...(body === undefined ? {} : { body }),
          });
        } catch (error) {
          pending.delete(id);
          clearTimeout(timer);
          reject(error);
        }
      });
      return await response;
    } catch {
      return Response.json(
        { error: "Backend unavailable; retry later" },
        {
          status: 503,
          headers: { "Retry-After": "1" },
        },
      );
    } finally {
      if (!admitted) reading--;
    }
  }
  async function shutdownBackend() {
    closing = true;
    const deadline = Date.now() + shutdownMs;
    while ((reading || pending.size) && Date.now() < deadline)
      await Bun.sleep(20);
    const backend = worker;
    if (backend && !pending.size) {
      backend.postMessage({ type: "shutdown" });
      while (!stopped && worker && Date.now() < deadline) await Bun.sleep(20);
    }
    backend?.terminate();
    worker = undefined;
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("Backend shutting down"));
    }
    pending.clear();
  }
  return { gateway, shutdownBackend };
}
export const { gateway, shutdownBackend } = createGateway({
  createWorker: () =>
    new Worker(
      resolve(
        process.cwd(),
        process.env.NODE_ENV === "production"
          ? "dist/backend-worker.js"
          : "src/server/worker.ts",
      ),
    ),
  trusted: trustedProxies(),
  country: createGeoip().country,
});
