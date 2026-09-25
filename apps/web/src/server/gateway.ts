import { resolve } from "node:path";
import { workerResponse } from "./worker-protocol";
let worker: Worker | undefined;
let inFlight = 0;
let closing = false;
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
  const instance = new Worker(
    resolve(
      process.cwd(),
      process.env.NODE_ENV === "production"
        ? "dist/backend-worker.js"
        : "src/server/worker.ts",
    ),
  );
  instance.onmessage = (event: MessageEvent<unknown>) => {
    const message = workerResponse.parse(event.data);
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
export async function gateway(request: Request, clientAddress = "127.0.0.1") {
  if (closing || inFlight >= 256)
    return Response.json(
      { error: "Server busy; retry later" },
      { status: 503, headers: { "Retry-After": "1" } },
    );
  inFlight++;
  try {
    const headers = new Headers(request.headers);
    headers.set("x-quacklytics-client-ip", clientAddress);
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
    const id = crypto.randomUUID();
    const backend = getWorker();
    try {
      return await new Promise<Response>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          resolve(
            Response.json(
              { error: "Request timed out; retry with the same event IDs" },
              { status: 504 },
            ),
          );
        }, 60000);
        pending.set(id, { resolve, reject, timer });
        backend.postMessage({
          id,
          url: request.url,
          method: request.method,
          headers: [...headers],
          ...(body === undefined ? {} : { body }),
        });
      });
    } catch {
      return Response.json(
        { error: "Backend unavailable; retry later" },
        { status: 503 },
      );
    }
  } finally {
    inFlight--;
  }
}
export async function shutdownBackend() {
  closing = true;
  const deadline = Date.now() + 15000;
  while (inFlight && Date.now() < deadline) await Bun.sleep(20);
  worker?.terminate();
  worker = undefined;
}
