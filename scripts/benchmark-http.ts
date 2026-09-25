/** End-to-end diagnostic, not a microbenchmark or a unit test. Uses a disposable server/data directory. */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { z } from "zod";
const dataDir = mkdtempSync(join(tmpdir(), "quacklytics-http-bench-"));
const origin = "http://127.0.0.1:4180";
const server = spawn("bun", ["server.ts"], {
  cwd: resolve("apps/web"),
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: "4180",
    APP_ORIGIN: origin,
    DATA_DIR: dataDir,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", (data: Buffer) => {
  logs += data.toString();
});
server.stderr.on("data", (data: Buffer) => {
  logs += data.toString();
});
let cookie = "";
async function api(path: string, data?: unknown, key?: string) {
  const response = await fetch(origin + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "X-API-KEY": key } : { Cookie: cookie, Origin: origin }),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  if (!response.ok)
    throw new Error(`${response.status}: ${await response.text()}`);
  const cookies = response.headers.getSetCookie();
  if (cookies.length)
    cookie = cookies.map((value) => value.split(";")[0]).join("; ");
  const value: unknown = await response.json();
  return value;
}
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
try {
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      await api("/api/health");
      break;
    } catch {
      if (attempt === 199) throw new Error(logs);
      await delay(50);
    }
  }
  await api("/api/auth/sign-up/email", {
    name: "Benchmark",
    email: "benchmark@example.com",
    password: "Benchmark-password-123",
  });
  const project = z
    .object({ id: z.string() })
    .parse(await api("/api/projects", { name: "Mixed HTTP benchmark" }));
  const keys = z
    .array(z.object({ key: z.string() }))
    .parse(await api(`/api/${project.id}/apikeys`, {}));
  const key = keys[0]?.key;
  if (!key) throw new Error("No ingestion key");
  const latencies: number[] = [],
    readLatencies: number[] = [];
  const batchCount = 200,
    batchSize = 100,
    concurrency = 4;
  let next = 0,
    done = false;
  const start = performance.now();
  const writes = Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < batchCount) {
        const batch = next++;
        const t = performance.now();
        await api(
          "/api/ingest",
          {
            requestId: crypto.randomUUID(),
            events: Array.from({ length: batchSize }, (_, index) => ({
              id: crypto.randomUUID(),
              eventType: index % 2 ? "view" : "purchase",
              timestamp: new Date().toISOString(),
              sessionId: `session-${batch}-${index}`,
              personId: `person-${batch}-${index}`,
              properties: { amount: index, page: "/benchmark" },
              personProperties: { plan: "pro" },
            })),
          },
          key,
        );
        latencies.push(performance.now() - t);
      }
    }),
  ).finally(() => {
    done = true;
  });
  const reads = (async () => {
    while (!done) {
      const t = performance.now();
      await api(`/api/${project.id}/events/catalog`);
      readLatencies.push(performance.now() - t);
      await delay(100);
    }
  })();
  await Promise.all([writes, reads]);
  const elapsed = performance.now() - start;
  const catalog = z
    .array(z.object({ eventCount: z.number() }))
    .parse(await api(`/api/${project.id}/events/catalog`));
  const rows = catalog.reduce((total, file) => total + file.eventCount, 0);
  if (rows !== batchCount * batchSize)
    throw new Error(`Expected ${batchCount * batchSize} rows, got ${rows}`);
  function percentile(values: number[], fraction: number) {
    const sorted = [...values].sort((a, b) => a - b);
    return (
      Math.round(
        (sorted[
          Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
        ] ?? 0) * 100,
      ) / 100
    );
  }
  const report = {
    runtime: process.versions.bun ?? process.version,
    platform: process.platform,
    arch: process.arch,
    events: rows,
    batchSize,
    concurrency,
    elapsedMs: Math.round(elapsed),
    eventsPerSecond: Math.round((rows / elapsed) * 1000),
    httpMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
    },
    catalogReads: readLatencies.length,
    catalogP95Ms: percentile(readLatencies, 0.95),
    walBytes: statSync(
      join(dataDir, "projects", project.id, "project.sqlite-wal"),
    ).size,
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  const exit = once(server, "exit");
  server.kill("SIGTERM");
  await exit;
  rmSync(dataDir, { recursive: true, force: true });
}
