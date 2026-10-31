import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { workerOrigin } from "../support/server";

const dataset = z.object({
  setupSql: z.string(),
  capturedAt: z.string(),
  eventCount: z.number(),
});
const toolText = z.object({
  content: z.array(z.object({ type: z.literal("text"), text: z.string() })),
  isError: z.boolean().optional(),
});
type Event = { id: string; eventType: string; timestamp: string };
const event = (eventType: string, timestamp: string): Event => ({
  id: crypto.randomUUID(),
  eventType,
  timestamp,
});

// A minimal Streamable HTTP client, as agents speak it: JSON-RPC over POST.
async function connect(origin: string, token: string) {
  let id = 0;
  const rpc = async (method: string, params: Record<string, unknown> = {}) => {
    const response = await fetch(origin + "/api/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2025-06-18",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    expect(response.status, await response.clone().text()).toBe(200);
    const message = z
      .object({ result: z.unknown().optional(), error: z.unknown().optional() })
      .parse(await response.json());
    if (message.error) throw new Error(JSON.stringify(message.error));
    return message.result;
  };
  const initialized = z
    .object({
      protocolVersion: z.string(),
      serverInfo: z.object({ name: z.string() }),
      instructions: z.string(),
    })
    .parse(
      await rpc("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "e2e-agent", version: "1.0.0" },
      }),
    );
  const tools = async () =>
    z
      .object({ tools: z.array(z.object({ name: z.string() })) })
      .parse(await rpc("tools/list"))
      .tools.map((tool) => tool.name);
  const text = async (name: string, args: Record<string, unknown> = {}) => {
    const result = toolText.parse(
      await rpc("tools/call", { name, arguments: args }),
    );
    const value = result.content[0]?.text ?? "";
    if (result.isError) throw new Error(value);
    return value;
  };
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    JSON.parse(await text(name, args));
  return { initialized, tools, text, call };
}

/** Runs the dataset's setup SQL the way an agent would, outside the server. */
async function queryDataset(setupSql: string) {
  const { stdout } = await promisify(execFile)(
    "bun",
    [
      "-e",
      `import { DuckDBInstance } from "@duckdb/node-api";
      const conn = await (await DuckDBInstance.create()).connect();
      await conn.run(Bun.argv.at(-1));
      const reader = await conn.runAndReadAll("SELECT id, event_type, properties->>'$.plan' AS plan FROM events ORDER BY timestamp");
      console.log(JSON.stringify(reader.getRowObjectsJS()));`,
      setupSql,
    ],
    { cwd: resolve("apps/web") },
  );
  return z
    .array(
      z.object({
        id: z.string(),
        event_type: z.string(),
        plan: z.string().nullable(),
      }),
    )
    .parse(JSON.parse(stdout));
}

test("an agent reads every event exactly once and the saved insights of each of its user's projects through MCP", async ({
  page,
}) => {
  test.setTimeout(120000);
  // The server writes S3 through this proxy, which records live-file uploads;
  // agents read S3 directly through the signed public endpoint.
  const storage = new URL(z.string().parse(process.env.S3_ENDPOINT));
  const liveUploads: string[] = [];
  const proxy = createServer((incoming, outgoing) => {
    const target = new URL(incoming.url ?? "/", storage);
    if (incoming.method === "PUT" && target.pathname.includes("/live/"))
      liveUploads.push(target.pathname);
    const forward = (target.protocol === "https:" ? httpsRequest : httpRequest)(
      target,
      { method: incoming.method, headers: incoming.headers },
      (response) => {
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(outgoing);
      },
    );
    forward.on("error", () => {
      outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(forward);
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  const { port } = z.object({ port: z.number() }).parse(proxy.address());
  const directory = mkdtempSync(join(tmpdir(), "quacklytics-mcp-"));
  const clock = join(directory, "clock");
  writeFileSync(clock, "2026-10-06T12:00:00.000Z");
  const origin = workerOrigin();
  let log = "";
  const server = spawn(
    "bun",
    ["--preload", resolve("tests/fixtures/analytics-clock.ts"), "server.ts"],
    {
      cwd: resolve("apps/web"),
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: new URL(origin).port,
        APP_ORIGIN: origin,
        DATA_DIR: join(directory, "data"),
        ANALYTICS_TEST_CLOCK: clock,
        S3_ENDPOINT: `http://127.0.0.1:${port}`,
        S3_PUBLIC_ENDPOINT: process.env.S3_PUBLIC_ENDPOINT ?? storage.href,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (data: Buffer) => {
    log += data.toString();
  });
  server.stderr.on("data", (data: Buffer) => {
    log += data.toString();
  });
  const api = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  try {
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(origin + "/api/health")).status;
          } catch {
            return 0;
          }
        },
        { timeout: 20000, message: log },
      )
      .toBe(200);
    expect(
      (
        await api.post("/api/auth/sign-up/email", {
          data: {
            email: "mcp@example.com",
            password: "Mcp-test-password-123",
            name: "Agent",
          },
        })
      ).ok(),
      log,
    ).toBeTruthy();
    // Projects start with one ingestion key; its full value is readable.
    const ingestionKey = async (projectId: string) => {
      const id = z
        .array(z.object({ id: z.number() }))
        .parse(await (await api.get(`/api/${projectId}/apikeys`)).json())
        .at(0)?.id;
      return z
        .object({ key: z.string() })
        .parse(await (await api.get(`/api/${projectId}/apikeys/${id}`)).json())
        .key;
    };
    const createProject = async (name: string) => {
      const project = z
        .object({ id: z.string() })
        .parse(
          await (await api.post("/api/projects", { data: { name } })).json(),
        );
      expect(
        (
          await api.post(`/api/${project.id}/settings`, {
            data: [{ key: "cors_origins", value: origin }],
          })
        ).ok(),
      ).toBeTruthy();
      const fullKey = await ingestionKey(project.id);
      const ingest = async (
        events: (Event & { properties?: Record<string, string> })[],
        deferExport = false,
      ) => {
        const response = await api.post("/api/ingest", {
          headers: { "X-API-KEY": fullKey },
          data: { requestId: crypto.randomUUID(), events, deferExport },
        });
        expect(response.ok(), await response.text()).toBeTruthy();
        expect(await response.json()).toMatchObject({
          committed: events.length,
        });
      };
      return { id: project.id, ingest };
    };
    const shop = await createProject("Shop");
    const other = await createProject("Other");

    // August is archived (S3 only), September and early October are published,
    // and today's event exists only in SQLite.
    const august = [
      {
        ...event("signup", "2026-08-03T10:00:00.000Z"),
        properties: { plan: "pro" },
      },
      event("purchase", "2026-08-20T10:00:00.000Z"),
    ];
    const september = [
      event("signup", "2026-09-01T00:00:00.000Z"),
      event("purchase", "2026-09-30T23:59:59.999Z"),
    ];
    const october = event("visit", "2026-10-02T09:00:00.000Z");
    const today = event("visit", "2026-10-06T08:00:00.000Z");
    await shop.ingest([...august, ...september, october, today]);
    expect(
      (await api.post(`/api/${shop.id}/events/catalog/gen`)).ok(),
      log,
    ).toBeTruthy();
    // A late September event makes that month dirty: its published file is stale,
    // so all of September must come from SQLite instead.
    const lateSeptember = event("refund", "2026-09-15T12:00:00.000Z");
    await shop.ingest([lateSeptember], true);
    await other.ingest([event("other-only", "2026-10-06T09:00:00.000Z")]);

    // The admin creates a token below the project list; it opens revealed,
    // with setup instructions for Claude Code and Codex.
    await page.context().addCookies((await api.storageState()).cookies);
    await page.goto(`${origin}/projects`);
    const section = page.getByRole("region", { name: "Agent access (MCP)" });
    await expect(
      section.getByText(`${origin}/api/mcp`, { exact: true }),
    ).toBeVisible();
    await expect(section.getByText("No access tokens.")).toBeVisible();
    // Setup instructions show a placeholder until a token is shown.
    await expect(
      section.getByText('--header "Authorization: Bearer <access token>"'),
    ).toBeVisible();
    const create = section.getByRole("button", { name: "Create access token" });
    const shownSecret = section.locator("pre", {
      hasText: /^qmcp_[0-9a-f]{64}$/,
    });
    const readShownSecret = async () => {
      await expect(shownSecret).toBeVisible();
      return z
        .string()
        .regex(/^qmcp_[0-9a-f]{64}$/)
        .parse(await shownSecret.textContent());
    };
    const row = (secret: string) =>
      section.getByRole("listitem").filter({ hasText: secret.slice(0, 12) });
    // A failed creation is reported rather than silently ignored.
    const tokensRoute = "**/api/mcptokens";
    await page.route(tokensRoute, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 503,
            json: { error: "Server busy; retry later" },
          })
        : route.fallback(),
    );
    await create.click();
    await expect(page.getByText("Failed to create access token")).toBeVisible();
    await expect(page.getByText("Server busy; retry later")).toBeVisible();
    await page.unroute(tokensRoute);
    await expect(section.getByText("No access tokens.")).toBeVisible();
    await create.click();
    const token = await readShownSecret();
    await expect(
      section.getByText(
        `claude mcp add --transport http quacklytics ${origin}/api/mcp --header "Authorization: Bearer ${token}"`,
      ),
    ).toBeVisible();
    await section.getByRole("tab", { name: "Codex" }).click();
    await expect(
      section.getByText(`http_headers = { Authorization = "Bearer ${token}" }`),
    ).toBeVisible();
    // After a reload the token is masked but its owner can reveal it again.
    await page.reload();
    await expect(row(token)).toContainText(token.slice(0, 12) + "•");
    await expect(page.getByText(token)).toHaveCount(0);
    await row(token).getByRole("button", { name: "Show access token" }).click();
    expect(await readShownSecret()).toBe(token);
    await row(token).getByRole("button", { name: "Hide access token" }).click();
    await expect(page.getByText(token)).toHaveCount(0);
    // Revoking a shown token removes its secret from the page.
    await create.click();
    const revoked = await readShownSecret();
    page.once("dialog", (dialog) => void dialog.accept());
    await row(revoked)
      .getByRole("button", { name: "Revoke access token" })
      .click();
    await expect(page.getByText(revoked)).toHaveCount(0);
    await expect(section.getByRole("listitem")).toHaveCount(1);
    // Only existing tokens of the signed-in user can be revealed.
    expect(
      (await api.get(`/api/mcptokens/${Number.MAX_SAFE_INTEGER}`)).status(),
    ).toBe(404);

    // One token reads every project; each call names the project it reads.
    const agent = await connect(origin, token);
    expect(agent.initialized.serverInfo.name).toBe("quacklytics");
    expect(agent.initialized.instructions).toContain("list_projects");
    expect((await agent.tools()).sort()).toEqual([
      "get_dataset",
      "get_insight",
      "get_query_guide",
      "get_schema",
      "list_dashboards",
      "list_insights",
      "list_projects",
    ]);
    expect(await agent.call("list_projects")).toEqual(
      expect.arrayContaining([
        { id: shop.id, name: "Shop" },
        { id: other.id, name: "Other" },
      ]),
    );
    expect(await agent.call("list_projects")).toHaveLength(2);
    const inShop = { project: shop.id };
    const inOther = { project: other.id };
    await expect(agent.call("get_schema")).rejects.toThrow("project");
    await expect(
      agent.call("get_schema", { project: "missing" }),
    ).rejects.toThrow("Project not found");

    // Sorted IDs match exactly, so the stale September file is not read
    // alongside the SQLite rows that replace it.
    const first = dataset.parse(await agent.call("get_dataset", inShop));
    expect(first.eventCount).toBe(7);
    const all = [...august, ...september, october, today, lateSeptember];
    const rows = await queryDataset(first.setupSql);
    expect(rows.map((row) => row.id).sort()).toEqual(
      all.map((item) => item.id).sort(),
    );
    expect(rows.find((row) => row.id === august[0]?.id)?.plan).toBe("pro");
    expect(liveUploads).toHaveLength(1);

    // Within 10 minutes the same snapshot is served with fresh URLs, even
    // after new events, so nothing is uploaded again.
    const later = event("visit", "2026-10-06T11:00:00.000Z");
    await shop.ingest([later], true);
    const repeated = dataset.parse(await agent.call("get_dataset", inShop));
    expect(liveUploads).toHaveLength(1);
    expect(repeated.capturedAt).toBe(first.capturedAt);
    expect(repeated.eventCount).toBe(7);
    expect(
      (await queryDataset(repeated.setupSql)).map((row) => row.id).sort(),
    ).toEqual(all.map((item) => item.id).sort());

    // Once the snapshot is 10 minutes old the next call captures a new one.
    // Months may be republished from now on; the union stays exact regardless.
    writeFileSync(clock, "2026-10-06T12:10:00.000Z");
    const second = dataset.parse(await agent.call("get_dataset", inShop));
    expect(second.capturedAt).toBe("2026-10-06T12:10:00.000Z");
    expect(second.eventCount).toBe(8);
    expect(liveUploads).toHaveLength(2);
    expect(
      (await queryDataset(second.setupSql)).map((row) => row.id).sort(),
    ).toEqual([...all, later].map((item) => item.id).sort());
    expect(await queryDataset(first.setupSql)).toHaveLength(7);

    expect(Object.keys(await agent.call("get_schema", inShop)).sort()).toEqual([
      "purchase",
      "refund",
      "signup",
      "visit",
    ]);
    expect(await agent.call("get_schema", inShop)).toMatchObject({
      signup: { plan: "string" },
    });
    const restInsights = z
      .array(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          type: z.string(),
        }),
      )
      .parse(await (await api.get(`/api/${shop.id}/insights`)).json());
    expect(restInsights.length).toBeGreaterThan(0);
    expect(await agent.call("list_insights", inShop)).toEqual(
      restInsights.map((insight) =>
        expect.objectContaining({
          id: insight.id,
          name: insight.name ?? null,
          type: insight.type,
        }),
      ),
    );
    const firstInsight = restInsights[0];
    if (!firstInsight) throw new Error("Missing insight");
    expect(
      await agent.call("get_insight", { ...inShop, id: firstInsight.id }),
    ).toEqual(
      await (
        await api.get(`/api/${shop.id}/insights/${firstInsight.id}`)
      ).json(),
    );
    await expect(
      agent.call("get_insight", { ...inShop, id: 999999 }),
    ).rejects.toThrow("Insight not found");
    const restDashboards = z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          insights: z.array(z.object({ id: z.number() })),
        }),
      )
      .parse(await (await api.get(`/api/${shop.id}/dashboards`)).json());
    expect(await agent.call("list_dashboards", inShop)).toEqual(
      restDashboards.map((dashboard) =>
        expect.objectContaining({
          id: dashboard.id,
          name: dashboard.name,
          insights: dashboard.insights.map((insight) =>
            expect.objectContaining({ id: insight.id }),
          ),
        }),
      ),
    );
    expect(await agent.text("get_query_guide")).toContain("read_parquet");

    // The same token reads the other project, and nothing of the shop leaks in.
    const otherRows = await queryDataset(
      dataset.parse(await agent.call("get_dataset", inOther)).setupSql,
    );
    expect(otherRows.map((row) => row.event_type)).toEqual(["other-only"]);
    expect(Object.keys(await agent.call("get_schema", inOther))).toEqual([
      "other-only",
    ]);
    // Tokens are managed by the user, not under a project.
    expect((await api.get(`/api/${shop.id}/mcptokens`)).status()).toBe(404);
    const anonymous = await request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    });
    expect((await anonymous.get("/api/mcptokens")).status()).toBe(401);
    expect((await anonymous.post("/api/mcptokens")).status()).toBe(401);
    await anonymous.dispose();
    const secondToken = z
      .object({ token: z.string() })
      .parse(await (await api.post("/api/mcptokens")).json()).token;

    // Missing, unknown and revoked tokens are rejected before any MCP handling.
    const post = (api: APIRequestContext, authorization?: string) =>
      api.post("/api/mcp", {
        headers: {
          Accept: "application/json, text/event-stream",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        data: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      });
    expect((await post(api)).status()).toBe(401);
    expect((await post(api, "Bearer qmcp_unknown")).status()).toBe(401);
    // Ingestion keys are public and must never grant read access.
    expect(
      (await post(api, `Bearer ${await ingestionKey(shop.id)}`)).status(),
    ).toBe(401);
    expect((await post(api, `Bearer ${token}`)).status()).toBe(200);
    await page.reload();
    await expect(row(secondToken)).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await row(token)
      .getByRole("button", { name: "Revoke access token" })
      .click();
    await expect(row(token)).toHaveCount(0);
    await expect(row(secondToken)).toBeVisible();
    expect((await post(api, `Bearer ${token}`)).status()).toBe(401);
    expect((await post(api, `Bearer ${secondToken}`)).status()).toBe(200);
  } finally {
    await api.dispose();
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGKILL");
      await exited;
    }
    proxy.closeAllConnections();
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});
