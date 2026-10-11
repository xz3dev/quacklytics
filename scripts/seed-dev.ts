import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ingestAcknowledgment,
  sdkRequest,
} from "../packages/tracker/src/protocol";
import {
  dashboard,
  insight,
  project,
  apiKey,
} from "../packages/contracts/src/index";
import { generateOrbit, orbitInsights, visitorsPerSignup } from "./demo/orbit";

const help = `Generate realistic SDK traffic for Orbit, a fictional project-management product,
through the real local ingestion API: website and app pageviews, autocaptured clicks,
identified users and custom events, in the browser and server SDKs' wire format.

Existing project (create a key in Settings):
  QUACKLYTICS_API_KEY=... bun run seed:dev

New project with six configured charts (existing local administrator):
  QUACKLYTICS_PASSWORD=... bun run seed:dev --email you@example.com

Options:
  --url URL       Local server origin (default http://127.0.0.1:3000)
  --api-key KEY   Existing project's ingestion key; or QUACKLYTICS_API_KEY
  --email EMAIL   Admin login; or QUACKLYTICS_EMAIL (creates a new demo project)
  --users N       Fictional users who sign up (default 250; 20–1000); ten times
                  as many visitors browse the website without signing up
  --days N        Complete UTC days of history, ending yesterday (default 365; 14–365)
  --seed N        Random seed for reproducible distributions (default 42)
  --help          Show this message

Each invocation adds a separate dataset with fresh IDs. No data is deleted.
API-key mode adds events only; email mode creates a project, insights and a dashboard.
`;
async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: "string" },
      "api-key": { type: "string" },
      email: { type: "string" },
      users: { type: "string" },
      days: { type: "string" },
      seed: { type: "string" },
      help: { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    console.log(help);
    return;
  }
  const origin = new URL(values.url ?? "http://127.0.0.1:3000");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ||
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error(
      "--url must be a local HTTP(S) origin, such as http://127.0.0.1:3000",
    );
  const users = z.coerce
    .number()
    .int()
    .min(20)
    .max(1000)
    .parse(values.users ?? 250);
  const days = z.coerce
    .number()
    .int()
    .min(14)
    .max(365)
    .parse(values.days ?? 365);
  const seed = z.coerce
    .number()
    .int()
    .min(0)
    .max(4294967295)
    .parse(values.seed ?? 42);
  let key = values["api-key"] ?? process.env.QUACKLYTICS_API_KEY;
  const email = values.email ?? process.env.QUACKLYTICS_EMAIL;
  const password = process.env.QUACKLYTICS_PASSWORD;
  if (!key && (!email || !password))
    throw new Error(
      "Provide QUACKLYTICS_API_KEY, or --email and QUACKLYTICS_PASSWORD. Run bun run seed:dev --help for examples.",
    );
  let cookie = "";
  async function api(
    path: string,
    data?: unknown,
    method = data === undefined ? "GET" : "POST",
  ) {
    const response = await fetch(new URL(path, origin), {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: origin.origin,
        Cookie: cookie,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
      throw new Error(
        `${method} ${path}: HTTP ${response.status} ${await response.text()}`,
      );
    const cookies = response.headers.getSetCookie();
    if (cookies.length)
      cookie = cookies.map((value) => value.split(";")[0]).join("; ");
    const result: unknown = await response.json();
    return result;
  }
  await api("/api/health");
  let projectId: string | undefined;
  if (!key) {
    await api("/api/auth/sign-in/email", { email, password });
    const created = project.parse(
      await api("/api/projects", {
        name: `Demo ${new Date().toISOString().slice(0, 10)}`,
      }),
    );
    projectId = created.id;
    const keys = apiKey
      .array()
      .parse(await api(`/api/${created.id}/apikeys`, {}));
    key = keys.at(-1)?.key;
    if (!key) throw new Error("The server did not return an ingestion key");
    console.log(`Created project: ${created.name} (${projectId})`);
  }
  const runId = randomUUID();
  const { operations, counts, from, to } = generateOrbit({
    users,
    days,
    seed,
    runId,
  });
  console.log(
    `Orbit: ${users} fictional sign-ups and ${users * visitorsPerSignup} other visitors, ${days} days, seed ${seed}.`,
  );
  console.log(
    `${from} → ${to}\nSending ${(operations.length - (counts.get("identify") ?? 0)).toLocaleString()} events and ${(counts.get("identify") ?? 0).toLocaleString()} identify calls to ${origin.origin}/api/backfill (run ${runId})…`,
  );
  // History may reach months already archived to S3, which only backfill accepts.
  const endpoint = new URL("/api/backfill", origin);
  async function deliver(body: string) {
    for (let attempt = 0; ; attempt++) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": key ?? "" },
        body,
        signal: AbortSignal.timeout(60000),
      });
      if (response.ok) return ingestAcknowledgment.parse(await response.json());
      // Request IDs make retries idempotent, exactly as in the SDK.
      if ((response.status !== 429 && response.status < 500) || attempt === 4)
        throw new Error(
          `POST /api/backfill: HTTP ${response.status} ${await response.text()}`,
        );
      const retryAfter = Number(response.headers.get("Retry-After"));
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : 250 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  const batchSize = 1000;
  const started = performance.now();
  let committed = 0;
  for (let offset = 0; offset < operations.length; offset += batchSize) {
    const batch = operations.slice(offset, offset + batchSize);
    const result = await deliver(
      JSON.stringify(
        sdkRequest.parse({
          protocolVersion: 1,
          requestId: randomUUID(),
          operations: batch,
        }),
      ),
    );
    if (result.committed + result.duplicates !== batch.length)
      throw new Error(
        `The server rejected ${batch.length - result.committed - result.duplicates} operations`,
      );
    committed += result.committed;
    if (offset % 20000 === 0 || offset + batchSize >= operations.length)
      console.log(
        `  ${Math.min(offset + batchSize, operations.length).toLocaleString()} / ${operations.length.toLocaleString()} committed`,
      );
  }
  const seconds = (performance.now() - started) / 1000;
  console.log(
    `Imported in ${seconds.toFixed(1)}s (${Math.round(committed / seconds).toLocaleString()} operations/s).`,
  );
  if (projectId) {
    const ids: number[] = [];
    for (const definition of orbitInsights(days))
      ids.push(
        insight.parse(await api(`/api/${projectId}/insights`, definition)).id,
      );
    const created = dashboard.parse(
      await api(`/api/${projectId}/dashboards`, {
        name: "Chart playground",
        favorite: true,
      }),
    );
    await api(
      `/api/${projectId}/dashboards/${created.id}/insights`,
      { insight_ids: ids },
      "PUT",
    );
    await api(`/api/${projectId}/dashboards/${created.id}/home`, {}, "PUT");
    await api(`/api/${projectId}/events/catalog/gen`, {});
    console.log(
      `\nOpen your demo dashboard: ${origin.origin}/app/${projectId}/dashboards/${created.id}`,
    );
  } else console.log("\nOpen or reload your project to query the latest data.");
  console.log("\nOperations by type:");
  for (const [name, count] of [...counts].sort(
    ([a, x], [b, y]) => y - x || a.localeCompare(b),
  ))
    console.log(`  ${name.padEnd(24)} ${count.toLocaleString()}`);
  console.log(
    "\nEvents carry the SDK's $context (page, browser, os, deviceType, language, timezone, viewport) and $country. See scripts/demo/README.md for chart recipes.",
  );
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
