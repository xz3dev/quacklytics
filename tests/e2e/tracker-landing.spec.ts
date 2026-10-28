import { test as base, expect, type Page } from "@playwright/test";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { resolve, join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { z } from "zod";
import { loginAsAdmin } from "../support/auth";
import type { AnalyticsClient } from "../../packages/tracker/src/index";

declare global {
  interface Window {
    quacklytics?: AnalyticsClient;
  }
}
const eventRows = z.array(
  z.object({
    id: z.string(),
    eventType: z.string(),
    timestamp: z.string(),
    sessionId: z.string().nullable(),
    personId: z.string().nullable(),
    properties: z.record(z.string(), z.json()),
  }),
);
type Landing = {
  project: string;
  other: string;
  key: string;
  origin: string;
  events: () => Promise<z.infer<typeof eventRows>>;
};
const test = base.extend<{ landing: Landing }>({
  landing: async ({ page, baseURL }, use) => {
    if (!baseURL) throw new Error("Missing service origin");
    await loginAsAdmin(page, baseURL);
    const create = async (name: string) => {
      const response = await page.request.post("/api/projects", {
        data: { name },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return z.object({ id: z.string() }).parse(await response.json()).id;
    };
    const project = await create("Landing SDK"),
      other = await create("SDK isolation");
    const keys = await page.request.post(`/api/${project}/apikeys`);
    const key = z
      .array(z.object({ key: z.string() }))
      .parse(await keys.json())
      .at(-1)?.key;
    if (!key) throw new Error("Missing ingestion key");
    const origin = "http://127.0.0.1:4325";
    expect(
      (
        await page.request.post(`/api/${project}/settings`, {
          data: [{ key: "cors_origins", value: JSON.stringify([origin]) }],
        })
      ).ok(),
    ).toBeTruthy();
    const child = spawn(
      "bun",
      [
        "run",
        "--cwd",
        "apps/home",
        "dev",
        "--host",
        "127.0.0.1",
        "--port",
        "4325",
        // Astro auto-backgrounds dev servers under coding agents; stay in the
        // foreground so this fixture owns the process and its environment.
        "--ignore-lock",
      ],
      {
        env: {
          ...process.env,
          PUBLIC_QUACKLYTICS_API_KEY: key,
          PUBLIC_QUACKLYTICS_HOST: baseURL,
          PUBLIC_QUACKLYTICS_PORT: "4173",
          PUBLIC_QUACKLYTICS_COOKIE_BANNER: "true",
        },
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let logs = "";
    child.stdout.on("data", (chunk: Buffer) => {
      logs += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      logs += chunk.toString();
    });
    try {
      await expect
        .poll(
          async () => {
            try {
              return (await fetch(origin)).status;
            } catch {
              return 0;
            }
          },
          { timeout: 30000, message: "Landing page starts" },
        )
        .toBe(200);
      await use({
        project,
        other,
        key,
        origin,
        events: async () =>
          eventRows.parse(
            await (
              await page.request.get(`${baseURL}/api/${project}/events`)
            ).json(),
          ),
      });
    } catch (error) {
      console.error(logs);
      throw error;
    } finally {
      if (child.pid && child.exitCode === null) {
        process.kill(-child.pid, "SIGTERM");
        await once(child, "exit");
      }
    }
  },
});
async function openAndAccept(page: Page, landing: Landing) {
  await page.goto(`${landing.origin}/?token=private#secret`);
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.evaluate(async () => {
    if (!window.quacklytics) throw new Error("SDK missing");
    await window.quacklytics.flush();
  });
}

test("landing consent, SPA pageviews, safe autocapture, identity, logout and persisted browser SQL", async ({
  page,
  landing,
  baseURL,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/ingest"))
      requests.push(request.postData() ?? "");
  });
  await page.goto(`${landing.origin}/?token=private#secret`);
  await expect(
    page.getByRole("button", { name: "Accept", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => {
      if (!window.quacklytics) throw new Error("SDK missing");
      return window.quacklytics.track("before_consent", { plan: "trial" });
    }),
  ).toMatchObject({ status: "buffered" });
  expect(requests).toHaveLength(0);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.endsWith(":identity")),
    ),
  ).toHaveLength(0);
  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.evaluate(async () => {
    await window.quacklytics?.flush();
  });
  const initial = await landing.events();
  expect(initial.map((row) => row.eventType).sort()).toEqual([
    "$pageview",
    "before_consent",
  ]);
  expect(initial[0]?.personId).toMatch(/^anonymous:/);
  expect(initial[1]?.personId).toBe(initial[0]?.personId);
  expect(initial[1]?.sessionId).toBe(initial[0]?.sessionId);
  expect(JSON.stringify(initial)).not.toContain("private");
  expect(JSON.stringify(initial)).not.toContain("#secret");

  // Exercise actual landing-page links without navigating away before assertions.
  const link = page.getByRole("link", { name: "Getting Started", exact: true });
  await link.evaluate((element) => {
    element.setAttribute(
      "href",
      "/start-here/introduction/?token=sensitive#private",
    );
    element.setAttribute("data-customer-email", "private@example.com");
    element.addEventListener("click", (event) => event.preventDefault());
  });
  await link.click();
  await link.evaluate((element) => element.setAttribute("data-ql-ignore", ""));
  await link.click();
  await link.evaluate((element) => {
    element.removeAttribute("data-ql-ignore");
    element.setAttribute("data-ql-event", "docs_opened");
  });
  await link.click();
  await page.evaluate(async () => {
    const sdk = window.quacklytics;
    if (!sdk) throw new Error("SDK missing");
    history.pushState({}, "", "/tour?secret=value");
    await Promise.resolve();
    await sdk.page(); // manual adapter + automatic navigation must deduplicate
    history.replaceState({}, "", "/tour?secret=different");
    await Promise.resolve();
    await sdk.flush();
    await sdk.identify("ada", { plan: "pro" });
    await sdk.track("purchase", { amount: 42 });
    await sdk.flush();
  });
  let rows = await landing.events();
  expect(rows.filter((row) => row.eventType === "$pageview")).toHaveLength(2);
  expect(rows.filter((row) => row.eventType === "$click")).toHaveLength(1);
  expect(rows.filter((row) => row.eventType === "docs_opened")).toHaveLength(1);
  expect(rows).toHaveLength(6);
  expect(rows.every((row) => row.personId === "user:ada")).toBe(true);
  expect(JSON.stringify(rows)).not.toMatch(
    /private@example|sensitive|secret=value/,
  );
  await page.evaluate(async () => {
    const sdk = window.quacklytics;
    if (!sdk) throw new Error("SDK missing");
    sdk.reset();
    await sdk.track("after_logout", {});
    await sdk.flush();
  });
  rows = await landing.events();
  const loggedOut = rows.find((row) => row.eventType === "after_logout");
  expect(loggedOut?.personId).toMatch(/^anonymous:/);
  expect(loggedOut?.sessionId).not.toBe(initial[0]?.sessionId);
  expect(
    await (
      await page.request.get(`${baseURL}/api/${landing.other}/events`)
    ).json(),
  ).toEqual([]);

  await page.goto(`${baseURL}/app/${landing.project}/queries`);
  await page
    .locator(".cm-content")
    .fill(
      "SELECT count(*) AS total, count(DISTINCT person_id) AS actors, sum(CASE WHEN event_type='purchase' THEN CAST(properties->>'amount' AS INTEGER) ELSE 0 END) AS revenue FROM events",
    );
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "7", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "42", exact: true }),
  ).toBeVisible();
});

test("landing revocation drops queued data, clears identifiers, persists denial, continues anonymously and synchronizes tabs", async ({
  page,
  landing,
  context,
}) => {
  await openAndAccept(page, landing);
  const second = await context.newPage();
  await second.goto(landing.origin);
  await second.evaluate(async () => {
    await window.quacklytics?.flush();
  });
  const before = await landing.events();
  await page.evaluate(async () => {
    const sdk = window.quacklytics;
    if (!sdk) throw new Error("SDK missing");
    await sdk.track("must_be_dropped", {});
    sdk.setConsent("denied");
    await sdk.flush();
  });
  await expect
    .poll(() => second.evaluate(() => window.quacklytics?.getConsent()))
    .toBe("denied");
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.quacklytics?.getConsent()))
    .toBe("denied");
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.endsWith(":identity")),
    ),
  ).toHaveLength(0);
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.endsWith(":outbox")),
    ),
  ).toHaveLength(0);
  await page.evaluate(async () => {
    await window.quacklytics?.track("still_denied", {});
    await window.quacklytics?.flush();
  });
  const denied = (await landing.events()).filter(
    (row) => !before.some((earlier) => earlier.id === row.id),
  );
  expect(denied.map((row) => row.eventType)).not.toContain("must_be_dropped");
  expect(denied.map((row) => row.eventType)).toContain("still_denied");
  expect(
    denied.every((row) =>
      /^anonymous:daily:[0-9a-f]{64}$/.test(row.personId ?? ""),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.endsWith(":identity")),
    ),
  ).toHaveLength(0);
  await page.evaluate(async () => {
    window.quacklytics?.setConsent("granted");
    await window.quacklytics?.flush();
  });
  const after = await landing.events();
  expect(after.length).toBeGreaterThan(before.length + denied.length);
  expect(after.at(-1)?.personId).not.toBe(before[0]?.personId);
  expect(after.at(-1)?.personId).not.toMatch(/^anonymous:daily:/);
});

test("landing retries a lost commit acknowledgment with an immutable envelope and recovers its outbox after reload", async ({
  page,
  landing,
}) => {
  await openAndAccept(page, landing);
  let attempts = 0;
  const bodies: string[] = [];
  await page.route("**/api/ingest", async (route) => {
    attempts++;
    bodies.push(route.request().postData() ?? "");
    if (attempts === 1) {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await route.abort("failed");
    } else await route.continue();
  });
  await page.evaluate(async () => {
    await window.quacklytics?.track("retry_me", { amount: 9 });
    await window.quacklytics?.flush();
  });
  expect(attempts).toBe(2);
  expect(bodies[0]).toBe(bodies[1]);
  expect(
    (await landing.events()).filter((row) => row.eventType === "retry_me"),
  ).toHaveLength(1);
  await page.unroute("**/api/ingest");
  await page.route("**/api/ingest", (route) =>
    route.fulfill({
      status: 503,
      headers: {
        "Access-Control-Allow-Origin": landing.origin,
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
  );
  const failure = await page.evaluate(async () => {
    await window.quacklytics?.track("offline", { nested: { ok: true } });
    try {
      await window.quacklytics?.flush();
      return "";
    } catch (error) {
      return String(error);
    }
  });
  expect(failure).toContain("503");
  await page.reload();
  await page.unroute("**/api/ingest");
  await page.evaluate(async () => {
    await window.quacklytics?.flush();
  });
  await expect
    .poll(
      async () =>
        (await landing.events()).filter((row) => row.eventType === "offline")
          .length,
    )
    .toBe(1);
  expect(
    (await landing.events()).find((row) => row.eventType === "offline")
      ?.properties.nested,
  ).toEqual({ ok: true });
});

test("landing rotates inactive sessions, links history across sessions and rejects conflicting identities atomically", async ({
  page,
  landing,
  baseURL,
}) => {
  // Two days back is closed history yet always within the archive grace week,
  // so identity links still rebuild its month.
  await page.clock.install({ time: new Date(Date.now() - 2 * 86400000) });
  await openAndAccept(page, landing);
  const first = (await landing.events())[0];
  const catalogSchema = z.array(
    z.object({ name: z.string(), partition: z.string() }),
  );
  const initialFiles = catalogSchema.parse(
    await (
      await page.request.post(
        `${baseURL}/api/${landing.project}/events/catalog/gen`,
      )
    ).json(),
  );
  expect(initialFiles).toHaveLength(1);
  await page.clock.setSystemTime(new Date(Date.now() + 31 * 60 * 1000));
  await page.evaluate(async () => {
    const sdk = window.quacklytics;
    if (!sdk) throw new Error("SDK missing");
    await sdk.track("new_session");
    await sdk.flush();
  });
  const second = (await landing.events()).find(
    (row) => row.eventType === "new_session",
  );
  expect(second?.sessionId).not.toBe(first?.sessionId);
  expect(second?.personId).toBe(first?.personId);
  await page.evaluate(async () => {
    await window.quacklytics?.identify("session-user", { tier: "paid" });
  });
  expect(
    (await landing.events()).every(
      (row) => row.personId === "user:session-user",
    ),
  ).toBe(true);
  const linkedFiles = catalogSchema.parse(
    await (
      await page.request.post(
        `${baseURL}/api/${landing.project}/events/catalog/gen`,
      )
    ).json(),
  );
  expect(linkedFiles).toHaveLength(1);
  expect(
    linkedFiles.find((file) => file.partition === initialFiles[0]?.partition)
      ?.name,
  ).not.toBe(initialFiles[0]?.name);
  const anonymousId = first?.personId?.replace(/^anonymous:/, "");
  if (!anonymousId) throw new Error("Missing anonymous identity");
  const response = await page.request.post(`${baseURL}/api/ingest`, {
    headers: { "X-API-KEY": landing.key },
    data: {
      protocolVersion: 1,
      requestId: crypto.randomUUID(),
      operations: [
        {
          kind: "event",
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          eventType: "rollback_me",
          properties: {},
          context: { sdk: { name: "@quacklytics/client", version: "0.2.0" } },
        },
        {
          kind: "identify",
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          anonymousId,
          userId: "different-user",
          traits: {},
        },
      ],
    },
  });
  expect(response.status()).toBe(409);
  expect((await landing.events()).map((row) => row.eventType)).not.toContain(
    "rollback_me",
  );
  const clientConflict = await page.evaluate(async () => {
    try {
      await window.quacklytics?.identify("other");
      return "";
    } catch (error) {
      return String(error);
    }
  });
  expect(clientConflict).toContain("Reset");
  expect(
    (await landing.events()).every(
      (row) => row.personId === "user:session-user",
    ),
  ).toBe(true);
});

test("landing works without browser storage and destroy removes automatic collection", async ({
  page,
  landing,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
  });
  await openAndAccept(page, landing);
  await page.evaluate(async () => {
    const sdk = window.quacklytics;
    if (!sdk) throw new Error("SDK missing");
    await sdk.track("memory_one");
    await sdk.track("memory_two");
    await sdk.flush();
  });
  const rows = await landing.events();
  expect(rows).toHaveLength(3);
  expect(new Set(rows.map((row) => row.personId)).size).toBe(1);
  await page
    .evaluate(async () => {
      const sdk = window.quacklytics;
      if (!sdk) throw new Error("SDK missing");
      await sdk.destroy();
      history.pushState({}, "", "/destroyed");
      const anchor = document.querySelector("a");
      anchor?.addEventListener("click", (event) => event.preventDefault());
      anchor?.click();
      return sdk.track("after_destroy");
    })
    .then((result) => expect(result).toEqual({ status: "disabled" }));
  expect(await landing.events()).toEqual(rows);
});

test("landing permanent errors are not retried and reserved events fail before transport", async ({
  page,
  landing,
}) => {
  await openAndAccept(page, landing);
  let attempts = 0;
  await page.route("**/api/ingest", (route) => {
    attempts++;
    return route.fulfill({
      status: 400,
      headers: { "Access-Control-Allow-Origin": landing.origin },
      body: "Rejected",
    });
  });
  const failure = await page.evaluate(async () => {
    await window.quacklytics?.track("bad_delivery");
    try {
      await window.quacklytics?.flush();
      return "";
    } catch (error) {
      return String(error);
    }
  });
  expect(failure).toContain("400");
  expect(attempts).toBe(1);
  await page.unroute("**/api/ingest");
  const reserved = await page.evaluate(async () => {
    try {
      await window.quacklytics?.track("$identify");
      return "";
    } catch (error) {
      return String(error);
    }
  });
  expect(reserved).toContain("Unknown reserved event");
  await page.evaluate(async () => {
    await window.quacklytics?.track("valid_after_failure");
    await window.quacklytics?.flush();
  });
  expect((await landing.events()).map((row) => row.eventType)).toEqual([
    "$pageview",
    "valid_after_failure",
  ]);
});

test("landing enforces queue bounds, snapshots context before batching, and applies redaction hooks", async ({
  page,
  landing,
  baseURL,
}) => {
  await openAndAccept(page, landing);
  await page.evaluate(async () => {
    await window.quacklytics?.destroy();
    delete window.quacklytics;
  });
  await page.addScriptTag({
    type: "module",
    content: `
    import { createClient } from ${JSON.stringify(`/@fs/${resolve("packages/tracker/dist/index.js")}`)};
    window.quacklytics = createClient({
      hostname: ${JSON.stringify(baseURL)}, apiKey: ${JSON.stringify(landing.key)},
      autoTrackPageviews: false, maxQueueSize: 2, batchSize: 10, flushIntervalMs: 60000, maxEventBytes: 2000,
      beforeSend(event) {
        if (event.eventType === 'drop_me') return null;
        delete event.properties.email;
        return event;
      }
    });
  `,
  });
  await expect.poll(() => page.evaluate(() => !!window.quacklytics)).toBe(true);
  const outcomes = await page.evaluate(async () => {
    const sdk = window.quacklytics;
    if (!sdk) throw new Error("SDK missing");
    const props = { email: "private@example.com", nested: { amount: 7 } };
    const dropped = await sdk.track("drop_me");
    await sdk.track("snapshot", props);
    props.nested.amount = 999;
    history.pushState({}, "", "/later");
    await sdk.track("second");
    let full = "",
      oversized = "";
    try {
      await sdk.track("overflow");
    } catch (error) {
      full = String(error);
    }
    await sdk.flush();
    try {
      await sdk.track("large", { text: "ü".repeat(2000) });
    } catch (error) {
      oversized = String(error);
    }
    return { dropped, full, oversized };
  });
  expect(outcomes.dropped).toEqual({ status: "dropped" });
  expect(outcomes.full).toContain("outbox is full");
  expect(outcomes.oversized).toContain("maxEventBytes");
  const rows = await landing.events();
  expect(rows.map((row) => row.eventType)).toEqual([
    "$pageview",
    "snapshot",
    "second",
  ]);
  const snapshot = rows.find((row) => row.eventType === "snapshot");
  expect(snapshot?.properties.nested).toEqual({ amount: 7 });
  expect(snapshot?.properties.email).toBeUndefined();
  expect(
    z
      .object({ page: z.object({ path: z.string() }) })
      .parse(snapshot?.properties.$context).page.path,
  ).toBe("/");
});

test("landing honors Retry-After and validates commit acknowledgments before removing its outbox", async ({
  page,
  landing,
}) => {
  await openAndAccept(page, landing);
  const calls: number[] = [];
  await page.route("**/api/ingest", async (route) => {
    calls.push(Date.now());
    if (calls.length === 1) {
      await route.fulfill({
        status: 429,
        headers: {
          "Access-Control-Allow-Origin": landing.origin,
          "Access-Control-Expose-Headers": "Retry-After",
          "Retry-After": "1",
        },
        body: "{}",
      });
    } else if (calls.length === 2) {
      const committed = await route.fetch();
      expect(committed.ok()).toBe(true);
      await route.fulfill({
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": landing.origin,
          "Content-Type": "application/json",
        },
        body: '{"committed":0,"duplicates":0,"revision":0}',
      });
    } else await route.continue();
  });
  await page.evaluate(async () => {
    await window.quacklytics?.track("rate_limited");
    await window.quacklytics?.flush();
  });
  expect(calls).toHaveLength(3);
  expect((calls[1] ?? 0) - (calls[0] ?? 0)).toBeGreaterThanOrEqual(950);
  expect(
    (await landing.events()).filter((row) => row.eventType === "rate_limited"),
  ).toHaveLength(1);
});

test("packed client installs independently and sends from Node and the landing browser with usable declarations", async ({
  page,
  landing,
  baseURL,
}) => {
  const directory = mkdtempSync(join(tmpdir(), "quacklytics-package-"));
  const exec = promisify(execFile);
  try {
    await exec(
      "bun",
      [
        "pm",
        "pack",
        "--filename",
        join(directory, "client.tgz"),
        "--ignore-scripts",
      ],
      { cwd: resolve("packages/tracker") },
    );
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({
        type: "module",
        dependencies: { "@quacklytics/client": "./client.tgz" },
      }),
    );
    await exec("bun", ["install", "--ignore-scripts"], { cwd: directory });
    const config = JSON.stringify({ hostname: baseURL, apiKey: landing.key });
    writeFileSync(
      join(directory, "server.mjs"),
      `
      import { createServerClient } from '@quacklytics/client/server';
      const client = createServerClient(${config});
      await client.track('server_invoice', { amount: 42 }, { userId: 'server-user' });
      await client.flush(); await client.destroy();
    `,
    );
    await exec(process.execPath, [join(directory, "server.mjs")], {
      cwd: directory,
    });
    const types = `import { createClient } from '@quacklytics/client';
      interface Events { purchase: { amount: number }; signup: { plan: string } }
      const client = createClient<Events>(${config});
      client.track('purchase', { amount: 42 });
      client.track('signup', { plan: 'pro' });
    `;
    writeFileSync(join(directory, "types.ts"), types);
    const typecheck = () =>
      exec(
        process.execPath,
        [
          resolve("node_modules/typescript/bin/tsc"),
          "--noEmit",
          "--strict",
          "--skipLibCheck",
          "--module",
          "nodenext",
          "--moduleResolution",
          "nodenext",
          "--target",
          "es2022",
          join(directory, "types.ts"),
        ],
        { cwd: directory },
      );
    await typecheck();
    writeFileSync(
      join(directory, "types.ts"),
      types + "\nclient.track('purchase', { amount: 'wrong' });",
    );
    await expect(typecheck()).rejects.toThrow();
    writeFileSync(
      join(directory, "browser.ts"),
      `
      import { createClient } from '@quacklytics/client';
      const client = createClient({ ...${config}, autoTrackPageviews: false });
      await client.track('installed_browser', { installed: true });
      await client.flush(); await client.destroy();
      document.documentElement.dataset.installedClient = 'committed';
    `,
    );
    await exec(
      "bun",
      ["build", "browser.ts", "--target=browser", "--outfile=browser.js"],
      { cwd: directory },
    );
    expect(readFileSync(join(directory, "browser.js"), "utf8")).not.toContain(
      "preact",
    );
    await openAndAccept(page, landing);
    await page.evaluate(async () => {
      await window.quacklytics?.destroy();
    });
    await page.addScriptTag({
      type: "module",
      path: join(directory, "browser.js"),
    });
    await expect(page.locator("html")).toHaveAttribute(
      "data-installed-client",
      "committed",
    );
    const rows = await landing.events();
    expect(
      rows.find((row) => row.eventType === "server_invoice")?.personId,
    ).toBe("user:server-user");
    expect(
      rows.find((row) => row.eventType === "installed_browser")?.properties
        .installed,
    ).toBe(true);
    expect(rows.map((row) => row.eventType)).toEqual([
      "server_invoice",
      "$pageview",
      "installed_browser",
    ]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("service bounds project ingestion independently and exposes Retry-After to browser callers", async ({
  page,
  landing,
  baseURL,
}) => {
  const data = {
    protocolVersion: 1,
    requestId: crypto.randomUUID(),
    operations: [
      {
        kind: "event",
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        eventType: "rate_budget",
        properties: {},
        context: { sdk: { name: "@quacklytics/client", version: "0.2.0" } },
      },
    ],
  };
  const statuses: number[] = [];
  for (let index = 0; index < 61; index++) {
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        page.request.post(`${baseURL}/api/ingest`, {
          headers: { "X-API-KEY": landing.key, Origin: landing.origin },
          data,
        }),
      ),
    );
    for (const response of responses) {
      statuses.push(response.status());
      if (response.status() === 429) {
        expect(Number(response.headers()["retry-after"])).toBeGreaterThan(0);
        expect(response.headers()["access-control-allow-origin"]).toBe(
          landing.origin,
        );
        expect(response.headers()["access-control-expose-headers"]).toBe(
          "Retry-After",
        );
      }
    }
  }
  expect(statuses.filter((status) => status === 200)).toHaveLength(600);
  expect(statuses.filter((status) => status === 429)).toHaveLength(10);
  expect(await landing.events()).toHaveLength(1);
  const keyResponse = await page.request.post(
    `${baseURL}/api/${landing.other}/apikeys`,
  );
  const otherKey = z
    .array(z.object({ key: z.string() }))
    .parse(await keyResponse.json())
    .at(-1)?.key;
  if (!otherKey) throw new Error("Missing other key");
  expect(
    (
      await page.request.post(`${baseURL}/api/ingest`, {
        headers: { "X-API-KEY": otherKey },
        data,
      })
    ).status(),
  ).toBe(200);
});

test("website traffic template reports real landing-page visitors and pages without changing existing dashboards", async ({
  page,
  landing,
  baseURL,
}) => {
  await page.clock.install({ time: new Date(Date.now() - 86400000) });
  await openAndAccept(page, landing);
  await page.evaluate(async () => {
    const sdk = window.quacklytics;
    if (!sdk) throw new Error("SDK missing");
    history.pushState({}, "", "/pricing");
    await Promise.resolve();
    await sdk.page();
    await sdk.flush();
    await sdk.identify("website-user");
  });
  await page.clock.setSystemTime(new Date());
  const original = await (
    await page.request.get(`${baseURL}/api/${landing.project}/dashboards`)
  ).json();
  const emptyResponse = await page.request.post(
    `${baseURL}/api/${landing.project}/dashboards`,
    { data: { name: "Traffic from the landing page", favorite: false } },
  );
  const empty = z.object({ id: z.number() }).parse(await emptyResponse.json());
  await page.goto(`${baseURL}/app/${landing.project}/dashboards/${empty.id}`);
  const applied = page.waitForResponse((response) =>
    response.url().endsWith("/templates/web_analytics"),
  );
  await page
    .getByRole("button", {
      name: "Apply web analytics template",
      exact: true,
    })
    .click();
  const response = await applied;
  expect(response.ok(), await response.text()).toBeTruthy();
  const dashboard = z
    .object({
      insights: z.array(z.object({ id: z.number(), name: z.string() })),
    })
    .parse(await response.json());
  expect(dashboard.insights.map((insight) => insight.name)).toEqual([
    "Visitors",
    "Pageviews",
    "Sessions",
    "Visitors and pageviews",
    "Visitors by country",
    "Top pages",
    "Referrers",
    "Custom events",
    "Devices",
    "Browsers",
    "Operating systems",
  ]);
  const visitor = dashboard.insights.find(
    (insight) => insight.name === "Visitors",
  );
  if (!visitor) throw new Error("Missing visitors insight");
  await page.goto(`${baseURL}/app/${landing.project}/insights/${visitor.id}`);
  await expect(page.getByLabel("Current value", { exact: true })).toHaveText(
    "1",
  );
  const views = dashboard.insights.find(
    (insight) => insight.name === "Pageviews",
  );
  if (!views) throw new Error("Missing pageview insight");
  await page.goto(`${baseURL}/app/${landing.project}/insights/${views.id}`);
  await expect(page.getByLabel("Current value", { exact: true })).toHaveText(
    "2",
  );
  const topPages = dashboard.insights.find(
    (insight) => insight.name === "Top pages",
  );
  if (!topPages) throw new Error("Missing top pages");
  await page.goto(`${baseURL}/app/${landing.project}/insights/${topPages.id}`);
  await expect(
    page.getByRole("img", { name: "Top pages", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("/pricing", { exact: true }).first(),
  ).toBeVisible();
  const all = z
    .array(z.object({ id: z.number() }).passthrough())
    .parse(
      await (
        await page.request.get(`${baseURL}/api/${landing.project}/dashboards`)
      ).json(),
    );
  expect(all.filter((dashboard) => dashboard.id !== empty.id)).toEqual(
    original,
  );
});

test("landing tabs honor rapid consent changes and account reset without reusing the old user", async ({
  page,
  landing,
  context,
}) => {
  await openAndAccept(page, landing);
  await page.evaluate(async () => {
    await window.quacklytics?.identify("previous-user");
  });
  const second = await context.newPage();
  await second.goto(landing.origin);
  await expect
    .poll(() => second.evaluate(() => !!window.quacklytics))
    .toBe(true);
  await second.evaluate(async () => {
    await window.quacklytics?.flush();
  });
  await page.evaluate(() => {
    const sdk = window.quacklytics;
    if (!sdk) throw new Error("SDK missing");
    sdk.setConsent("denied");
    sdk.setConsent("granted");
  });
  await expect
    .poll(() => second.evaluate(() => window.quacklytics?.getConsent()))
    .toBe("granted");
  await second.evaluate(async () => {
    await window.quacklytics?.track("after_rapid_consent");
    await window.quacklytics?.flush();
  });
  expect(
    (await landing.events()).find(
      (row) => row.eventType === "after_rapid_consent",
    )?.personId,
  ).toMatch(/^anonymous:/);
  await page.evaluate(async () => {
    await window.quacklytics?.identify("next-user");
  });
  await second.evaluate(async () => {
    await window.quacklytics?.track("next_account");
    await window.quacklytics?.flush();
  });
  expect(
    (await landing.events()).find((row) => row.eventType === "next_account")
      ?.personId,
  ).toBe("user:next-user");
  await page.evaluate(() => {
    window.quacklytics?.reset();
  });
  await second.evaluate(async () => {
    await window.quacklytics?.track("after_other_tab_reset");
    await window.quacklytics?.flush();
  });
  const actor = (await landing.events()).find(
    (row) => row.eventType === "after_other_tab_reset",
  )?.personId;
  expect(actor).toMatch(/^anonymous:/);
});

test("landing buffers undecided visitors locally across reloads and releases them with full attribution on accept", async ({
  page,
  landing,
}) => {
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/ingest")) requests++;
  });
  const storedKeys = () =>
    page.evaluate(() =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith("ql:"))
        .map((key) => key.split(":").at(-1)),
    );
  await page.goto(landing.origin);
  await expect(
    page.getByRole("button", { name: "Accept", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    const sdk = window.quacklytics;
    if (!sdk) throw new Error("SDK missing");
    await sdk.track("chose_plan", { plan: "pro" });
    await sdk.identify("grace", { plan: "pro" });
    await sdk.flush();
  });
  // A navigation before deciding must keep the earlier captures.
  await page.reload();
  await page.evaluate(async () => {
    await window.quacklytics?.track("after_reload");
    await window.quacklytics?.flush();
  });
  expect(requests).toBe(0);
  expect(await storedKeys()).toEqual(["buffer"]);
  expect(await landing.events()).toEqual([]);

  await page.getByRole("button", { name: "Accept", exact: true }).click();
  await page.evaluate(async () => {
    await window.quacklytics?.flush();
  });
  const rows = await landing.events();
  expect(rows.map((row) => row.eventType).sort()).toEqual([
    "$pageview",
    "$pageview",
    "after_reload",
    "chose_plan",
  ]);
  expect(rows.every((row) => row.personId === "user:grace")).toBe(true);
  expect(new Set(rows.map((row) => row.sessionId)).size).toBe(1);
  expect(
    rows.find((row) => row.eventType === "chose_plan")?.properties,
  ).toMatchObject({
    plan: "pro",
  });
  expect(await storedKeys()).not.toContain("buffer");
});

test("landing rejection releases buffered events anonymously under a daily identity without person data", async ({
  page,
  landing,
  browser,
}) => {
  await page.goto(landing.origin);
  await page.evaluate(async () => {
    const sdk = window.quacklytics;
    if (!sdk) throw new Error("SDK missing");
    await sdk.track("before_decision");
    await sdk.identify("must-not-link", { email: "private@example.com" });
  });
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  const results = await page.evaluate(async () => {
    const sdk = window.quacklytics;
    if (!sdk) throw new Error("SDK missing");
    const identified = await sdk.identify("must-not-link");
    await sdk.track("after_decision");
    await sdk.flush();
    return { identified };
  });
  expect(results.identified).toEqual({ status: "disabled" });
  // Reloading recomputes the same identity; nothing about the visitor is stored.
  await page.reload();
  await page.evaluate(async () => {
    await window.quacklytics?.track("after_reload");
    await window.quacklytics?.flush();
  });
  expect(
    await page.evaluate(() =>
      [...Object.keys(localStorage), ...Object.keys(sessionStorage)]
        .filter((key) => key.startsWith("ql:"))
        .map((key) => key.split(":").at(-1)),
    ),
  ).toEqual(["consent"]);
  await expect(
    page.getByRole("button", { name: "Reject", exact: true }),
  ).toHaveCount(0);

  const today = await landing.events();
  expect(today.map((row) => row.eventType).sort()).toEqual([
    "$pageview",
    "$pageview",
    "after_decision",
    "after_reload",
    "before_decision",
  ]);
  const actor = today[0]?.personId;
  expect(actor).toMatch(/^anonymous:daily:[0-9a-f]{64}$/);
  expect(today.every((row) => row.personId === actor)).toBe(true);
  expect(new Set(today.map((row) => row.sessionId)).size).toBe(1);
  expect(JSON.stringify(today)).not.toMatch(/must-not-link|private@example/);

  // A different browser on the same day is a different anonymous visitor.
  const other = await browser.newContext({ userAgent: "QuacklyticsTest/1.0" });
  try {
    const otherPage = await other.newPage();
    await otherPage.goto(landing.origin);
    await otherPage
      .getByRole("button", { name: "Reject", exact: true })
      .click();
    await otherPage.evaluate(async () => {
      await window.quacklytics?.track("other_browser");
      await window.quacklytics?.flush();
    });
  } finally {
    await other.close();
  }
  const otherActor = (await landing.events()).find(
    (row) => row.eventType === "other_browser",
  )?.personId;
  expect(otherActor).toMatch(/^anonymous:daily:/);
  expect(otherActor).not.toBe(actor);
});
