import { test, expect } from "bun:test";
import { createGateway } from "../../apps/web/src/server/gateway";

// Purpose: deterministic worker/HTTP timeout ordering and admission failure paths
// cannot be reliably induced through production E2E without timing or fault hooks.
// A real controlled worker lets us retain assertions about actual admission and recovery.
test("HTTP timeout retains backend capacity until completion, then admits new work", async () => {
  const worker = new Worker(
    new URL("../fixtures/gateway-worker.ts", import.meta.url).href,
  );
  const { gateway, shutdownBackend } = createGateway({
    createWorker: () => worker,
    maxOutstanding: 1,
    timeoutMs: 200,
    shutdownMs: 1000,
  });
  try {
    expect((await gateway(new Request("http://test/ready"))).status).toBe(200);
    expect((await gateway(new Request("http://test/hold"))).status).toBe(504);
    const rejected = await gateway(new Request("http://test/ready"));
    expect(rejected.status).toBe(503);
    expect(rejected.headers.get("Retry-After")).toBe("1");
    const completed = new Promise<void>((resolve) =>
      worker.addEventListener("message", () => resolve(), { once: true }),
    );
    worker.postMessage({ type: "release" });
    await completed;
    expect((await gateway(new Request("http://test/ready"))).status).toBe(200);
  } finally {
    await shutdownBackend();
  }
  expect((await gateway(new Request("http://test/ready"))).status).toBe(503);
});

test("worker failure releases outstanding work and permits a fresh worker", async () => {
  const workers: Worker[] = [];
  const { gateway, shutdownBackend } = createGateway({
    createWorker: () => {
      const worker = new Worker(
        new URL("../fixtures/gateway-worker.ts", import.meta.url).href,
      );
      workers.push(worker);
      return worker;
    },
    timeoutMs: 1000,
    shutdownMs: 1000,
  });
  try {
    const blocked = gateway(new Request("http://test/hold"));
    const failed = workers[0];
    if (!failed) throw new Error("Worker was not created");
    failed.dispatchEvent(
      new ErrorEvent("error", { message: "Injected worker failure" }),
    );
    expect((await blocked).status).toBe(503);
    expect((await gateway(new Request("http://test/ready"))).status).toBe(200);
    expect(workers).toHaveLength(2);
    expect(
      (
        await gateway(
          new Request("http://test/ready", {
            method: "POST",
            body: "x".repeat(2_000_001),
          }),
        )
      ).status,
    ).toBe(413);
    expect((await gateway(new Request("http://test/ready"))).status).toBe(200);
  } finally {
    await shutdownBackend();
  }
});

// Purpose: hold a request body open across shutdown to exercise the reservation
// race without relying on operating-system socket buffering in browser E2E.
test("body readers reserve capacity and cannot start a backend after shutdown", async () => {
  let finishBody: (() => void) | undefined;
  let workers = 0;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      finishBody = () => controller.close();
    },
  });
  const { gateway, shutdownBackend } = createGateway({
    createWorker: () => {
      workers++;
      return new Worker(
        new URL("../fixtures/gateway-worker.ts", import.meta.url).href,
      );
    },
    maxOutstanding: 1,
    shutdownMs: 20,
  });
  const uploading = gateway(
    new Request("http://test/ready", { method: "POST", body }),
  );
  expect((await gateway(new Request("http://test/ready"))).status).toBe(503);
  await shutdownBackend();
  finishBody?.();
  expect((await uploading).status).toBe(503);
  expect(workers).toBe(0);
});
