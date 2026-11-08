import { test, expect, request, type Page } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  UnauthorizedError,
  type OAuthClientProvider,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { withServer, workerOrigin } from "../support/server";

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

// Agents receive authorization codes on a loopback callback. Nothing listens
// there: the browser's navigation to it is intercepted to read the code.
const callback = "http://127.0.0.1:4999/callback";

/** One agent's OAuth state, kept in memory the way an agent stores it on disk. */
class AgentAuth implements OAuthClientProvider {
  registration: OAuthClientInformationMixed | undefined = undefined;
  saved: OAuthTokens | undefined = undefined;
  verifier = "";
  pendingAuthorization: URL | undefined = undefined;
  constructor(
    readonly name: string,
    readonly redirectUrl = callback,
  ) {}
  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: this.name,
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }
  clientInformation() {
    return this.registration;
  }
  saveClientInformation(registration: OAuthClientInformationMixed) {
    this.registration = registration;
  }
  tokens() {
    return this.saved;
  }
  saveTokens(tokens: OAuthTokens) {
    this.saved = tokens;
  }
  redirectToAuthorization(url: URL) {
    this.pendingAuthorization = url;
  }
  saveCodeVerifier(verifier: string) {
    this.verifier = verifier;
  }
  codeVerifier() {
    return this.verifier;
  }
  invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier") {
    if (scope === "all" || scope === "client") this.registration = undefined;
    if (scope === "all" || scope === "tokens") this.saved = undefined;
    if (scope === "all" || scope === "verifier") this.verifier = "";
  }
}

const clientInfo = { name: "e2e-agent", version: "1.0.0" };

/**
 * The SDK's Streamable HTTP client transport, which runs the OAuth flow, seen
 * through its Transport interface. Its sessionId getter returns
 * `string | undefined`, which that interface rejects under
 * exactOptionalPropertyTypes, so this view forwards everything else.
 */
function agentTransport(url: URL, auth: AgentAuth) {
  const http = new StreamableHTTPClientTransport(url, { authProvider: auth });
  const transport: Transport = {
    start: () => http.start(),
    send: (message, options) => http.send(message, options),
    close: () => http.close(),
    setProtocolVersion: (version) => http.setProtocolVersion(version),
  };
  http.onmessage = (message) => transport.onmessage?.(message);
  http.onerror = (error) => transport.onerror?.(error);
  http.onclose = () => transport.onclose?.();
  return { http, transport };
}

/** Calls a tool with the MCP SDK client and returns its text. */
async function text(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const result = toolText.parse(
    await client.callTool({ name, arguments: args }),
  );
  const value = result.content[0]?.text ?? "";
  if (result.isError) throw new Error(value);
  return value;
}
const call = async (
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) => JSON.parse(await text(client, name, args));

/** Waits for the browser to reach the agent's callback and returns the query it received. */
async function callbackParams(page: Page) {
  await page.waitForURL((url) => url.href.startsWith(callback + "?"));
  return new URL(page.url()).searchParams;
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

test("an agent signs in with OAuth and reads every event exactly once and the saved insights of each of its user's projects through MCP", async ({
  page,
}) => {
  test.setTimeout(180000);
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
  const mcpUrl = new URL(`${origin}/api/mcp`);
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
  // Browser navigations to the agent's callback show a stand-in page.
  await page.route(
    (url) => url.href.startsWith(callback),
    (route) =>
      route.fulfill({ contentType: "text/plain", body: "Agent authorized" }),
  );
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

    // Without a token the endpoint answers with an RFC 9728 challenge that
    // points agents to the metadata naming this app as authorization server.
    const rawCall = (authorization?: string) =>
      fetch(mcpUrl, {
        method: "POST",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2025-11-25",
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
    const anonymousCall = await rawCall();
    expect(anonymousCall.status).toBe(401);
    expect(anonymousCall.headers.get("www-authenticate")).toBe(
      `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp", scope="mcp:read offline_access"`,
    );
    expect(
      z
        .object({
          resource: z.string(),
          authorization_servers: z.array(z.string()),
          scopes_supported: z.array(z.string()),
        })
        .parse(
          await (
            await fetch(
              `${origin}/.well-known/oauth-protected-resource/api/mcp`,
            )
          ).json(),
        ),
    ).toEqual(
      expect.objectContaining({
        resource: `${origin}/api/mcp`,
        authorization_servers: [`${origin}/api/auth`],
        scopes_supported: ["mcp:read"],
      }),
    );
    const serverMetadata = z
      .object({
        issuer: z.string(),
        registration_endpoint: z.string(),
        code_challenge_methods_supported: z.array(z.string()),
        grant_types_supported: z.array(z.string()),
      })
      .parse(
        await (
          await fetch(
            `${origin}/.well-known/oauth-authorization-server/api/auth`,
          )
        ).json(),
      );
    expect(serverMetadata).toMatchObject({
      issuer: `${origin}/api/auth`,
      registration_endpoint: `${origin}/api/auth/oauth2/register`,
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "refresh_token"],
    });

    // The MCP SDK's own client discovers the server, registers itself and asks
    // for a browser sign-in bound to this resource with PKCE.
    const agentAuth = new AgentAuth("E2E Agent");
    const firstTransport = agentTransport(mcpUrl, agentAuth);
    await expect(
      new Client(clientInfo).connect(firstTransport.transport),
    ).rejects.toThrow(UnauthorizedError);
    const authorization = z
      .instanceof(URL)
      .parse(agentAuth.pendingAuthorization);
    expect(authorization.searchParams.get("resource")).toBe(
      `${origin}/api/mcp`,
    );
    expect(authorization.searchParams.get("scope")).toBe(
      "mcp:read offline_access",
    );
    expect(authorization.searchParams.get("code_challenge_method")).toBe(
      "S256",
    );

    // Signed out, the browser signs in first and the authorization continues
    // to the consent page, which names the agent and where access goes.
    await page.goto(authorization.href);
    await expect(page).toHaveURL(/\/login\?/);
    await expect(
      page.getByText("Sign in to review an agent's request for access."),
    ).toBeVisible();
    await page.getByLabel("Email").fill("mcp@example.com");
    await page.getByLabel("Password").fill("Mcp-test-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/oauth\/consent\?/);
    const consent = page.getByRole("region", { name: "E2E Agent" });
    await expect(
      consent.getByText("an app on this computer (127.0.0.1:4999)"),
    ).toBeVisible();
    await expect(
      consent.getByText(
        "Read the events, schema, saved insights and dashboards of all your projects",
      ),
    ).toBeVisible();
    await expect(
      consent.getByText(
        "Stay connected until you disconnect it on the Projects page",
      ),
    ).toBeVisible();
    await consent.getByRole("button", { name: "Allow access" }).click();
    const granted = await callbackParams(page);
    expect(granted.get("iss")).toBe(`${origin}/api/auth`);
    await firstTransport.http.finishAuth(z.string().parse(granted.get("code")));
    expect(agentAuth.saved?.refresh_token).toBeTruthy();
    const agent = new Client(clientInfo);
    await agent.connect(agentTransport(mcpUrl, agentAuth).transport);

    // The signed-in user's agent reads every project; each call names the project it reads.
    expect(agent.getServerVersion()?.name).toBe("quacklytics");
    expect(agent.getInstructions()).toContain("list_projects");
    expect(
      (await agent.listTools()).tools.map((tool) => tool.name).sort(),
    ).toEqual([
      "get_dataset",
      "get_insight",
      "get_query_guide",
      "get_schema",
      "list_dashboards",
      "list_insights",
      "list_projects",
    ]);
    expect(await call(agent, "list_projects")).toEqual(
      expect.arrayContaining([
        { id: shop.id, name: "Shop" },
        { id: other.id, name: "Other" },
      ]),
    );
    expect(await call(agent, "list_projects")).toHaveLength(2);
    const inShop = { project: shop.id };
    const inOther = { project: other.id };
    await expect(call(agent, "get_schema")).rejects.toThrow("project");
    await expect(
      call(agent, "get_schema", { project: "missing" }),
    ).rejects.toThrow("Project not found");

    // Sorted IDs match exactly, so the stale September file is not read
    // alongside the SQLite rows that replace it.
    const first = dataset.parse(await call(agent, "get_dataset", inShop));
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
    const repeated = dataset.parse(await call(agent, "get_dataset", inShop));
    expect(liveUploads).toHaveLength(1);
    expect(repeated.capturedAt).toBe(first.capturedAt);
    expect(repeated.eventCount).toBe(7);
    expect(
      (await queryDataset(repeated.setupSql)).map((row) => row.id).sort(),
    ).toEqual(all.map((item) => item.id).sort());

    // Once the snapshot is 10 minutes old the next call captures a new one.
    // Months may be republished from now on; the union stays exact regardless.
    writeFileSync(clock, "2026-10-06T12:10:00.000Z");
    const second = dataset.parse(await call(agent, "get_dataset", inShop));
    expect(second.capturedAt).toBe("2026-10-06T12:10:00.000Z");
    expect(second.eventCount).toBe(8);
    expect(liveUploads).toHaveLength(2);
    expect(
      (await queryDataset(second.setupSql)).map((row) => row.id).sort(),
    ).toEqual([...all, later].map((item) => item.id).sort());
    expect(await queryDataset(first.setupSql)).toHaveLength(7);

    expect(Object.keys(await call(agent, "get_schema", inShop)).sort()).toEqual(
      ["purchase", "refund", "signup", "visit"],
    );
    expect(await call(agent, "get_schema", inShop)).toMatchObject({
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
    expect(await call(agent, "list_insights", inShop)).toEqual(
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
      await call(agent, "get_insight", { ...inShop, id: firstInsight.id }),
    ).toEqual(
      await (
        await api.get(`/api/${shop.id}/insights/${firstInsight.id}`)
      ).json(),
    );
    await expect(
      call(agent, "get_insight", { ...inShop, id: 999999 }),
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
    expect(await call(agent, "list_dashboards", inShop)).toEqual(
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
    expect(await text(agent, "get_query_guide")).toContain("read_parquet");

    // The same agent reads the other project, and nothing of the shop leaks in.
    const otherRows = await queryDataset(
      dataset.parse(await call(agent, "get_dataset", inOther)).setupSql,
    );
    expect(otherRows.map((row) => row.event_type)).toEqual(["other-only"]);
    expect(Object.keys(await call(agent, "get_schema", inOther))).toEqual([
      "other-only",
    ]);

    // Already signed in, a second agent goes straight to consent. Denying
    // tells it so and grants nothing.
    const deniedAuth = new AgentAuth("Denied Agent");
    await expect(
      new Client(clientInfo).connect(
        agentTransport(mcpUrl, deniedAuth).transport,
      ),
    ).rejects.toThrow(UnauthorizedError);
    await page.goto(
      z.instanceof(URL).parse(deniedAuth.pendingAuthorization).href,
    );
    await expect(
      page.getByRole("region", { name: "Denied Agent" }),
    ).toBeVisible();
    // A request altered after the server signed it is refused, not granted.
    const deniedConsent = page.url();
    const altered = new URL(deniedConsent);
    altered.searchParams.set("scope", "mcp:read");
    await page.goto(altered.href);
    await page.getByRole("button", { name: "Allow access" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "This approval request has expired or was changed.",
    );
    expect(page.url()).not.toContain(callback);
    await page.goto(deniedConsent);
    await page.getByRole("button", { name: "Deny" }).click();
    const denied = await callbackParams(page);
    expect(denied.get("error")).toBe("access_denied");
    expect(denied.get("code")).toBeNull();
    const registered = async (clientId: string) =>
      (
        await api.get(
          `/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`,
        )
      ).status();
    const deniedClient = z
      .object({ client_id: z.string() })
      .parse(deniedAuth.registration).client_id;
    expect(await registered(deniedClient)).toBe(200);

    // Expired access tokens are refreshed by the agent without a new sign-in.
    const issued = agentAuth.saved?.access_token;
    writeFileSync(clock, "2026-10-06T14:30:00.000Z");
    expect((await rawCall(`Bearer ${issued}`)).status).toBe(401);
    expect(await call(agent, "list_projects")).toHaveLength(2);
    const refreshed = agentAuth.saved?.access_token;
    expect(refreshed).toBeTruthy();
    expect(refreshed).not.toBe(issued);

    // Tokens must name this server as audience and carry the read scope.
    const manualClient = z.object({ client_id: z.string() }).parse(
      await (
        await fetch(`${origin}/api/auth/oauth2/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: "Manual Agent",
            redirect_uris: [callback],
            token_endpoint_auth_method: "none",
            grant_types: ["authorization_code", "refresh_token"],
            response_types: ["code"],
          }),
        })
      ).json(),
    ).client_id;
    const manualCode = async (scope: string, resource?: string) => {
      const verifier = randomBytes(32).toString("base64url");
      const authorize = new URL(`${origin}/api/auth/oauth2/authorize`);
      authorize.search = new URLSearchParams({
        response_type: "code",
        client_id: manualClient,
        redirect_uri: callback,
        scope,
        prompt: "consent",
        code_challenge: createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        code_challenge_method: "S256",
        ...(resource ? { resource } : {}),
      }).toString();
      await page.goto(authorize.href);
      await page.getByRole("button", { name: "Allow access" }).click();
      const code = z.string().parse((await callbackParams(page)).get("code"));
      return { code, verifier, resource };
    };
    const redeem = (grant: Awaited<ReturnType<typeof manualCode>>) =>
      fetch(`${origin}/api/auth/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: grant.code,
          redirect_uri: callback,
          client_id: manualClient,
          code_verifier: grant.verifier,
          ...(grant.resource ? { resource: grant.resource } : {}),
        }),
      });
    const accessToken = async (response: Response) => {
      expect(response.status, await response.clone().text()).toBe(200);
      return z.object({ access_token: z.string() }).parse(await response.json())
        .access_token;
    };
    const manualToken = async (scope: string, resource?: string) =>
      accessToken(await redeem(await manualCode(scope, resource)));
    const unbound = await manualToken("mcp:read offline_access");
    expect((await rawCall(`Bearer ${unbound}`)).status).toBe(401);
    const readless = await manualToken("offline_access", `${origin}/api/mcp`);
    const insufficient = await rawCall(`Bearer ${readless}`);
    expect(insufficient.status).toBe(403);
    expect(insufficient.headers.get("www-authenticate")).toContain(
      'error="insufficient_scope", scope="mcp:read"',
    );
    const manualAccess = await manualToken(
      "mcp:read offline_access",
      `${origin}/api/mcp`,
    );
    expect((await rawCall(`Bearer ${manualAccess}`)).status).toBe(200);
    // Bearer tokens are not DPoP-bound, and ingestion keys are public and
    // must never grant read access.
    expect((await rawCall(`DPoP ${manualAccess}`)).status).toBe(401);
    expect(
      (await rawCall(`Bearer ${await ingestionKey(shop.id)}`)).status,
    ).toBe(401);

    // Approved agents are listed on the Projects page with setup instructions.
    await page.goto(`${origin}/projects`);
    const section = page.getByRole("region", { name: "Agent access (MCP)" });
    await expect(
      section.getByText(`${origin}/api/mcp`, { exact: true }),
    ).toBeVisible();
    await expect(
      section.getByText(
        `claude mcp add --transport http quacklytics ${origin}/api/mcp`,
      ),
    ).toBeVisible();
    await section.getByRole("tab", { name: "Codex" }).click();
    await expect(
      section.getByText(`codex mcp add quacklytics --url ${origin}/api/mcp`),
    ).toBeVisible();
    const listed = section.getByRole("listitem");
    await expect(listed).toHaveCount(2);
    await expect(listed.filter({ hasText: "E2E Agent" })).toContainText(
      "127.0.0.1:4999",
    );
    await expect(listed.filter({ hasText: "Manual Agent" })).toHaveCount(1);
    await expect(section.getByText("Denied Agent")).toHaveCount(0);

    // Disconnecting revokes at once: the access token stops working, the
    // refresh is refused, and the agent has to ask for approval again.
    page.once("dialog", (dialog) => void dialog.accept());
    await section.getByRole("button", { name: "Disconnect E2E Agent" }).click();
    await expect(listed).toHaveCount(1);
    await expect(listed).toContainText("Manual Agent");
    expect((await rawCall(`Bearer ${refreshed}`)).status).toBe(401);
    agentAuth.pendingAuthorization = undefined;
    await expect(call(agent, "list_projects")).rejects.toThrow(
      UnauthorizedError,
    );
    expect(agentAuth.pendingAuthorization).toBeInstanceOf(URL);
    // Other agents keep their access.
    expect((await rawCall(`Bearer ${manualAccess}`)).status).toBe(200);

    // Agent access belongs to the signed-in user, not to a project.
    expect((await api.get("/api/agents")).ok()).toBeTruthy();
    expect((await api.get(`/api/${shop.id}/agents`)).status()).toBe(404);
    expect((await api.delete("/api/agents/unknown")).status()).toBe(404);
    const anonymous = await request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    });
    expect((await anonymous.get("/api/agents")).status()).toBe(401);
    expect(
      (await anonymous.delete(`/api/agents/${manualClient}`)).status(),
    ).toBe(401);
    await anonymous.dispose();

    // An hour after they were made, registrations without consent or tokens
    // are removed the next time an agent registers or refreshes; connected
    // agents stay.
    const disconnectedClient = z
      .object({ client_id: z.string() })
      .parse(agentAuth.registration).client_id;
    expect(await registered(deniedClient)).toBe(404);
    expect(await registered(disconnectedClient)).toBe(404);
    expect(await registered(manualClient)).toBe(200);
    // Anyone may register an agent, so oversized registrations are refused.
    expect(
      (
        await fetch(`${origin}/api/auth/oauth2/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: "x".repeat(20000),
            redirect_uris: [callback],
            token_endpoint_auth_method: "none",
          }),
        })
      ).status,
    ).toBe(413);

    // Access needs consent: removing it through Better Auth's own API ends
    // access, even for tokens issued later from a code granted before.
    const earlierGrant = await manualCode(
      "mcp:read offline_access",
      `${origin}/api/mcp`,
    );
    const consentId = z
      .array(z.object({ id: z.string(), clientId: z.string() }))
      .parse(await (await api.get("/api/auth/oauth2/get-consents")).json())
      .find((consent) => consent.clientId === manualClient)?.id;
    expect(
      (
        await api.post("/api/auth/oauth2/delete-consent", {
          data: { id: z.string().parse(consentId) },
        })
      ).ok(),
    ).toBeTruthy();
    expect((await rawCall(`Bearer ${manualAccess}`)).status).toBe(401);
    const lateToken = await accessToken(await redeem(earlierGrant));
    expect((await rawCall(`Bearer ${lateToken}`)).status).toBe(401);
    // Disconnecting also invalidates codes the agent has not redeemed yet.
    const unredeemed = await manualCode(
      "mcp:read offline_access",
      `${origin}/api/mcp`,
    );
    expect((await api.delete(`/api/agents/${manualClient}`)).ok()).toBeTruthy();
    expect((await redeem(unredeemed)).status).toBe(400);

    // Agents stay connected after the browser session that approved them
    // expires: they refresh and keep working without a new sign-in.
    const lastingAuth = new AgentAuth("Lasting Agent");
    const lastingFirst = agentTransport(mcpUrl, lastingAuth);
    await expect(
      new Client(clientInfo).connect(lastingFirst.transport),
    ).rejects.toThrow(UnauthorizedError);
    await page.goto(
      z.instanceof(URL).parse(lastingAuth.pendingAuthorization).href,
    );
    await page.getByRole("button", { name: "Allow access" }).click();
    await lastingFirst.http.finishAuth(
      z.string().parse((await callbackParams(page)).get("code")),
    );
    const lasting = new Client(clientInfo);
    await lasting.connect(agentTransport(mcpUrl, lastingAuth).transport);
    writeFileSync(clock, "2026-10-17T12:00:00.000Z");
    expect(await call(lasting, "list_projects")).toHaveLength(2);
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

test("agent access stays off, without breaking the app, when the origin is plain HTTP on a network host", async ({
  page,
}) => {
  const port = new URL(workerOrigin()).port;
  const appOrigin = `http://analytics.internal:${port}`;
  await withServer({ APP_ORIGIN: appOrigin }, async (origin) => {
    const mcp = await fetch(`${origin}/api/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(mcp.status).toBe(503);
    expect(await mcp.text()).toContain("HTTPS");
    expect(
      (await fetch(`${origin}/.well-known/oauth-protected-resource/api/mcp`))
        .status,
    ).toBe(404);
    expect(
      (
        await fetch(`${origin}/api/auth/oauth2/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ redirect_uris: [callback] }),
        })
      ).status,
    ).toBe(404);
    // Signing in and the rest of the app keep working.
    const api = await request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: appOrigin },
    });
    try {
      expect(
        (
          await api.post("/api/auth/sign-up/email", {
            data: {
              email: "plain@example.com",
              password: "Plain-http-password-42",
              name: "Plain",
            },
          })
        ).ok(),
      ).toBeTruthy();
      expect(await (await api.get("/api/agents")).json()).toEqual({
        endpoint: null,
        agents: [],
      });
      await page.context().addCookies((await api.storageState()).cookies);
      await page.goto(`${origin}/projects`);
      await expect(
        page
          .getByRole("region", { name: "Agent access (MCP)" })
          .getByText("Agents can only sign in over HTTPS"),
      ).toBeVisible();
    } finally {
      await api.dispose();
    }
  });
});
