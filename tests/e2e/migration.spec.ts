import { test, expect, type Cookie } from "@playwright/test";
let authenticatedCookies: Cookie[] = [];
import { z } from "zod";
const credentials = {
  email: "migration@example.com",
  password: "Migration-test-password-42",
};
test("setup, project, durable ingestion, browser analytics and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const setup = z
    .object({ adminRegistered: z.boolean() })
    .parse(await (await page.request.get("/api/setup")).json());
  await page.goto(setup.adminRegistered ? "/login" : "/register");
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  if (!setup.adminRegistered)
    await page.getByLabel("Confirm password").fill(credentials.password);
  await page
    .getByRole("button", {
      name: setup.adminRegistered ? "Sign in" : "Create account",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: /^(New project|Create your first project)$/ })
    .click();
  await expect(page).toHaveURL(/\/projects\/new$/);
  await page.getByLabel("Project name", { exact: true }).fill("Migration E2E");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByRole("link", { name: "Skip for now", exact: true }).click();
  await expect(page).toHaveURL(/\/app\//);
  const project = page.url().split("/app/")[1]?.split("/")[0];
  expect(project).toBeTruthy();
  if (!project) throw new Error("Missing project");
  await expect(
    page.getByRole("img", {
      name: /^Trend chart preview\. Illustrative sample only/,
    }),
  ).toBeVisible();
  const keyResponse = await page.request.post(`/api/${project}/apikeys`);
  expect(keyResponse.ok()).toBeTruthy();
  const keys = z
    .array(z.object({ key: z.string() }))
    .parse(await keyResponse.json());
  // Setup already created a key; only the new one carries its full value.
  const key = keys.find((entry) => !entry.key.endsWith("…"))?.key;
  if (!key) throw new Error("Missing key");
  // Default calendar charts cover complete UTC days, excluding today.
  const now = new Date(Date.now() - 86400000);
  const payload = {
    requestId: crypto.randomUUID(),
    events: [
      {
        id: crypto.randomUUID(),
        eventType: "signup",
        timestamp: now.toISOString(),
        personId: "person-1",
        sessionId: "session-1",
        properties: { plan: "pro", amount: 42 },
        personProperties: { name: "Ada" },
      },
      {
        id: crypto.randomUUID(),
        eventType: "purchase",
        timestamp: new Date(now.getTime() + 1).toISOString(),
        personId: "person-1",
        sessionId: "session-1",
        properties: { amount: 99 },
      },
    ],
  };
  const response = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key },
    data: payload,
  });
  expect(response.status(), await response.text()).toBe(200);
  expect(await response.json()).toMatchObject({ committed: 2, duplicates: 0 });
  const retry = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key },
    data: payload,
  });
  expect(await retry.json()).toMatchObject({ committed: 2 });
  await page.reload();
  await expect(
    page.getByText("Web Analytics Overview", { exact: true }).first(),
  ).toBeVisible();
  // The default dashboard reports pageviews; server events count as custom.
  await expect(
    page.getByRole("link", { name: "Custom events", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Visitors by country", exact: true }),
  ).toBeVisible();
  await page.goto(`/app/${project}/events`);
  await expect(page.getByText("signup", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("purchase", { exact: true }).first(),
  ).toBeVisible();
  authenticatedCookies = await page.context().cookies();
  expect(errors).toEqual([]);
});

async function signIn(page: import("@playwright/test").Page) {
  if (authenticatedCookies.length)
    await page.context().addCookies(authenticatedCookies);
  if ((await page.request.get("/api/me")).ok()) return;
  const setupResponse = await page.request.get("/api/setup");
  const setup = z
    .object({ adminRegistered: z.boolean() })
    .parse(await setupResponse.json());
  const response = await page.request.post(
    setup.adminRegistered
      ? "/api/auth/sign-in/email"
      : "/api/auth/sign-up/email",
    {
      headers: { Origin: new URL(setupResponse.url()).origin },
      data: { ...credentials, name: "Migration" },
    },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  authenticatedCookies = await page.context().cookies();
}
async function projectFixture(
  page: import("@playwright/test").Page,
  name: string,
) {
  await signIn(page);
  const project = z
    .object({ id: z.string() })
    .parse(
      await (
        await page.request.post("/api/projects", { data: { name } })
      ).json(),
    );
  // Every project starts with one key; read its full value.
  const keyId = z
    .array(z.object({ id: z.number() }))
    .parse(await (await page.request.get(`/api/${project.id}/apikeys`)).json())
    .at(-1)?.id;
  if (keyId === undefined) throw new Error("Project has no key");
  const key = z
    .object({ key: z.string() })
    .parse(
      await (
        await page.request.get(`/api/${project.id}/apikeys/${keyId}`)
      ).json(),
    ).key;
  return { project: project.id, key, keyId };
}
/** Replaces the pageview-based default with event charts for server events. */
async function eventsHome(
  page: import("@playwright/test").Page,
  project: string,
) {
  const { dashboard } = await import("../../packages/contracts/src/index");
  const response = await page.request.post(
    `/api/${project}/dashboards/templates/product_analytics`,
    { data: { home: true } },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  return dashboard.parse(await response.json()).insights;
}
function event(eventType: string, extra: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    properties: {},
    ...extra,
  };
}

test("ingestion key copy uses the complete persisted key and respects project isolation", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const fixture = await projectFixture(page, "Copy key E2E");
  await page.goto(`/app/${fixture.project}/ingestion`);
  await page
    .getByRole("button", { name: "Reveal ingestion key", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Copy ingestion key", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(fixture.key);
  expect(fixture.key).toHaveLength(72);

  // Copying does not require revealing the key first.
  await page.reload();
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page
    .getByRole("button", { name: "Copy ingestion key", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(fixture.key);
  await expect(
    page.getByRole("button", { name: "Reveal ingestion key", exact: true }),
  ).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(fixture.key);
  const ingested = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": copied },
    data: { requestId: crypto.randomUUID(), events: [event("copied-key")] },
  });
  expect(ingested.status(), await ingested.text()).toBe(200);

  const other = await projectFixture(page, "Other copy key E2E");
  expect(
    (
      await page.request.get(`/api/${other.project}/apikeys/${fixture.keyId}`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await context.request.get(
        `/api/${fixture.project}/apikeys/${fixture.keyId}`,
      )
    ).ok(),
  ).toBeTruthy();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No ingestion keys found.")).toBeVisible();
  expect(
    (
      await page.request.get(`/api/${fixture.project}/apikeys/${fixture.keyId}`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post("/api/ingest", {
        headers: { "X-API-KEY": copied },
        data: {
          requestId: crypto.randomUUID(),
          events: [event("deleted-key")],
        },
      })
    ).status(),
  ).toBe(401);
});

test("unrecoverable ingestion keys display an error without offering a truncated copy", async ({
  page,
}) => {
  const fixture = await projectFixture(page, "Old key E2E");
  await page.route(
    `**/api/${fixture.project}/apikeys/${fixture.keyId}`,
    (route) =>
      route.fulfill({
        status: 409,
        json: {
          error:
            "This older key cannot be recovered. Create a new ingestion key to copy its full value.",
        },
      }),
  );
  await page.goto(`/app/${fixture.project}/ingestion`);
  await page
    .getByRole("button", { name: "Reveal ingestion key", exact: true })
    .click();
  await expect(
    page.getByText(
      "This older key cannot be recovered. Create a new ingestion key to copy its full value.",
      { exact: true },
    ),
  ).toBeVisible();
  // The send-data examples need the same key, so they surface the failure too.
  await expect(
    page.getByText(
      "Loading the ingestion key failed: This older key cannot be recovered. Create a new ingestion key to copy its full value.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy ingestion key", exact: true }),
  ).toHaveCount(0);
});

test("atomic batches, idempotency, identity replay, typed JSON and isolation", async ({
  page,
}) => {
  const fixture = await projectFixture(page, "Identity E2E");
  const headers = { "X-API-KEY": fixture.key };
  const anonymous = event("view", {
    sessionId: "session",
    personProperties: { plan: "free", old: true },
    properties: {
      nested: { active: true },
      items: [1, "two"],
      nothing: null,
      count: 7,
    },
  });
  const ingest = (events: unknown[]) =>
    page.request.post("/api/ingest", {
      headers,
      data: { requestId: crypto.randomUUID(), events },
    });
  expect((await ingest([anonymous])).status()).toBe(200);
  const upgrade = event("identify", {
    sessionId: "session",
    personId: "ada",
    personProperties: { plan: "pro" },
  });
  expect((await ingest([upgrade])).status()).toBe(200);
  const before = await page.request.get(`/api/${fixture.project}/events`);
  const rows = z
    .array(
      z.object({
        id: z.string(),
        personId: z.string().nullable(),
        properties: z.record(z.string(), z.unknown()),
      }),
    )
    .parse(await before.json());
  expect(rows.find((r) => r.id === anonymous.id)?.personId).toBe("ada");
  expect(rows.find((r) => r.id === anonymous.id)?.properties).toEqual(
    anonymous.properties,
  );
  const conflict = await ingest([
    event("must-rollback"),
    { ...anonymous, eventType: "conflicting" },
  ]);
  expect(conflict.status()).toBe(409);
  const after = z
    .array(z.object({ eventType: z.string() }))
    .parse(
      await (await page.request.get(`/api/${fixture.project}/events`)).json(),
    );
  expect(after).toHaveLength(2);
  expect(after.some((r) => r.eventType === "must-rollback")).toBe(false);
  const duplicate = await ingest([anonymous]);
  expect(await duplicate.json()).toMatchObject({ committed: 0, duplicates: 1 });
  const schema = await (
    await page.request.get(`/api/${fixture.project}/schema`)
  ).json();
  expect(schema).toMatchObject({
    view: {
      count: { type: "number" },
      nested: { type: "json" },
      nothing: { type: "json" },
    },
  });
  const other = await projectFixture(page, "Isolated E2E");
  expect(
    await (await page.request.get(`/api/${other.project}/events`)).json(),
  ).toEqual([]);
  // Export the linked identities, then verify those identities through browser SQL.
  await page.goto(`/app/${fixture.project}/events`);
  await expect(page.getByText("view", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("ada", { exact: true }).first()).toBeVisible();
});

test("ingestion origin policy, preflight, key revocation and unauthorized reads", async ({
  page,
  request,
}) => {
  const fixture = await projectFixture(page, "Access E2E");
  expect((await request.get(`/api/${fixture.project}/events`)).status()).toBe(
    401,
  );
  expect((await request.get("/api/projects")).status()).toBe(401);
  expect((await request.post("/api/ingest", { data: {} })).status()).toBe(401);
  await page.request.post(`/api/${fixture.project}/settings`, {
    data: [{ key: "cors_origins", value: "https://allowed.example" }],
  });
  const allowed = await request.fetch("/api/ingest", {
    method: "OPTIONS",
    headers: {
      Origin: "https://allowed.example",
      "Access-Control-Request-Headers": "content-type,x-api-key",
    },
  });
  expect(allowed.status()).toBe(204);
  expect(allowed.headers()["access-control-allow-origin"]).toBe(
    "https://allowed.example",
  );
  const payload = { requestId: crypto.randomUUID(), events: [event("secure")] };
  expect(
    (
      await request.post("/api/ingest", {
        headers: {
          "X-API-KEY": fixture.key,
          Origin: "https://blocked.example",
        },
        data: payload,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/ingest", {
        headers: {
          "X-API-KEY": fixture.key,
          Origin: "https://allowed.example",
        },
        data: payload,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.delete(
        `/api/${fixture.project}/apikeys/${fixture.keyId}`,
      )
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/ingest", {
        headers: { "X-API-KEY": fixture.key },
        data: payload,
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/auth/sign-up/email", {
        data: { ...credentials, email: "second@example.com", name: "Second" },
      })
    ).ok(),
  ).toBe(false);
  expect(
    (
      await page.request.post(`/api/${fixture.project}/settings`, {
        headers: { Origin: "https://blocked.example" },
        data: [{ key: "name", value: "Hacked" }],
      })
    ).status(),
  ).toBe(403);
});

test("all insight definitions persist and dashboards preserve ordering across reload", async ({
  page,
}) => {
  const { defaultInsights } =
    await import("../../packages/contracts/src/index");
  const fixture = await projectFixture(page, "Insights E2E");
  // Calendar ranges end yesterday; keep the entire funnel in completed days.
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const events = [
    event("signup", {
      personId: "a",
      timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
    }),
    event("purchase", { personId: "a", timestamp: yesterday }),
    event("signup", { personId: "b", timestamp: yesterday }),
  ];
  expect(
    (
      await page.request.post("/api/ingest", {
        headers: { "X-API-KEY": fixture.key },
        data: { requestId: crypto.randomUUID(), events },
      })
    ).ok(),
  ).toBeTruthy();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const ids: number[] = [];
  for (const [kind, definition] of Object.entries(defaultInsights)) {
    const config =
      kind === "Funnel"
        ? {
            funnel: {
              duration: "P30D",
              countingMode: "uniqueUsers",
              steps: ["signup", "purchase"].map((name, order) => ({
                id: crypto.randomUUID(),
                name,
                order,
                query: {
                  filters: [
                    {
                      field: { name: "event_type", type: "string" },
                      operator: "=",
                      value: name,
                    },
                  ],
                },
              })),
            },
          }
        : definition.config;
    const response = await page.request.post(
      `/api/${fixture.project}/insights`,
      { data: { ...definition, config, name: `E2E ${kind}` } },
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const insight = z.object({ id: z.number() }).parse(await response.json());
    ids.push(insight.id);
    await page.goto(`/app/${fixture.project}/insights/${insight.id}`);
    await expect(
      page.getByText("Something went wrong!", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(`E2E ${kind}`, { exact: true }).first(),
    ).toBeVisible();
    if (["Trend", "Breakdown", "Funnel", "Path"].includes(kind))
      await expect(
        page.getByRole("img", { name: `E2E ${kind}`, exact: true }),
      ).toBeVisible();
    if (kind === "Value")
      await expect(
        page
          .getByText("Current period", { exact: true })
          .locator("..")
          .getByText("3", { exact: true }),
      ).toBeVisible();
    if (kind === "Breakdown")
      await expect(
        page.getByRole("row").filter({ hasText: "signup" }),
      ).toContainText("2");
    if (kind === "Funnel")
      await expect(
        page.getByRole("row").filter({ hasText: "purchase" }),
      ).toContainText("50.0%");
    if (kind === "Retention") {
      const chart = page.getByRole("img", {
        name: "E2E Retention",
        exact: true,
      });
      await expect(chart).toBeVisible();
      await expect(page.getByRole("table")).toHaveCount(0);
      await chart
        .locator(".ts-chart__rect rect")
        .first()
        .hover({ position: { x: 4, y: 4 } });
      await expect(page.getByRole("status")).toHaveAccessibleName(
        /Retention: 100%/,
      );
      await expect(page.getByRole("status")).toHaveAccessibleName(/Users: 1/);
    }
    await expect(page.getByText(/^Error:/)).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  const created = await page.request.post(
    `/api/${fixture.project}/dashboards`,
    { data: { name: "E2E saved dashboard", favorite: true } },
  );
  const dashboard = z.object({ id: z.number() }).parse(await created.json());
  const ordered = [...ids].reverse();
  expect(
    (
      await page.request.put(
        `/api/${fixture.project}/dashboards/${dashboard.id}/insights`,
        { data: { insight_ids: ordered } },
      )
    ).ok(),
  ).toBeTruthy();
  await page.goto(`/app/${fixture.project}/dashboards/${dashboard.id}`);
  await expect(
    page.getByText("E2E saved dashboard", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  const saved = z
    .object({ insights: z.array(z.object({ id: z.number() })) })
    .parse(
      await (
        await page.request.get(
          `/api/${fixture.project}/dashboards/${dashboard.id}`,
        )
      ).json(),
    );
  expect(saved.insights.map((i) => i.id)).toEqual(ordered);
  await page.request.delete(`/api/${fixture.project}/insights/${ids[0]}`);
  const remaining = z
    .object({ insights: z.array(z.object({ id: z.number() })) })
    .parse(
      await (
        await page.request.get(
          `/api/${fixture.project}/dashboards/${dashboard.id}`,
        )
      ).json(),
    );
  expect(remaining.insights).toHaveLength(ids.length - 1);
});

test("tracker retries an acknowledged request and browser SQL refreshes late data on reload", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing test origin");
  const fixture = await projectFixture(page, "Tracker SQL E2E");
  const { createClient } = await import("../../packages/tracker/src/index");
  let attempts = 0;
  const client = createClient({
    hostname: baseURL,
    apiKey: fixture.key,
    autoTrackPageviews: false,
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      attempts++;
      if (attempts === 1)
        throw new Error(
          "Simulated lost acknowledgement after server committed",
        );
      return response;
    },
  });
  await client.sendBatch([
    { eventType: "sdk", sessionId: "sdk-session", properties: { amount: 12 } },
    { eventType: "sdk", sessionId: "sdk-session", properties: { amount: 30 } },
  ]);
  expect(attempts).toBe(2);
  await page.goto(`/app/${fixture.project}/queries`);
  const editor = page.locator(".cm-content");
  await editor.fill(
    "SELECT count(*) AS event_count, sum(CAST(properties->>'amount' AS INTEGER)) AS total FROM events",
  );
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "42", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "2", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).first().click();
  await page.getByLabel("Query Name", { exact: true }).fill("SDK totals");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.reload();
  await page.getByRole("tab", { name: "Saved Queries", exact: true }).click();
  await expect(page.getByText("SDK totals", { exact: true })).toBeVisible();
  await client.send({
    eventType: "sdk",
    timestamp: new Date(Date.now() - 86400000),
    sessionId: "sdk-session",
    personId: "identified",
    properties: { amount: 8 },
  });
  await page.reload();
  await page.getByRole("tab", { name: "Query Editor", exact: true }).click();
  await editor.fill(
    "SELECT count(*) AS event_count, count(DISTINCT person_id) AS people, sum(CAST(properties->>'amount' AS INTEGER)) AS total FROM events",
  );
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(page.getByRole("cell", { name: "50", exact: true })).toBeVisible(
    { timeout: 30000 },
  );
  await expect(
    page.getByRole("cell", { name: "3", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "1", exact: true }),
  ).toBeVisible();
});

test("project rename, ingestion and insight edits persist through the UI", async ({
  page,
}) => {
  const fixture = await projectFixture(page, "Editing E2E");
  await page.goto(`/app/${fixture.project}/ingestion`);
  await expect(
    page.getByRole("link", { name: "Settings", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Select project", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Rename Editing E2E", exact: true })
    .click();
  await page.getByLabel("Project name", { exact: true }).fill("   ");
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();

  await page
    .getByLabel("Project name", { exact: true })
    .fill("Renamed project");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Project name updated!", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("New origin", { exact: true })
    .fill("https://example.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Remove https://example.com",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();

  await expect(
    page.getByRole("button", { name: "Select project", exact: true }),
  ).toContainText("Renamed project");
  await page
    .getByRole("button", { name: "Select project", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Rename Renamed project", exact: true })
    .click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(
    "Renamed project",
  );
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Discarded rename");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Select project", exact: true }),
  ).toContainText("Renamed project");

  await expect(
    page.getByRole("button", {
      name: "Remove https://example.com",
      exact: true,
    }),
  ).toBeVisible();
  const insights = z
    .array(z.object({ id: z.number(), type: z.string() }))
    .parse(
      await (await page.request.get(`/api/${fixture.project}/insights`)).json(),
    );
  const trend = insights.find((i) => i.type === "Trend");
  if (!trend) throw new Error("Missing default trend");
  await page.goto(`/app/${fixture.project}/insights/${trend.id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("combobox").filter({ hasText: "Day" }).click();
  await page.getByRole("option", { name: "Week", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("combobox").filter({ hasText: "Week" }),
  ).toBeVisible();
  const saved = await (
    await page.request.get(`/api/${fixture.project}/insights/${trend.id}`)
  ).json();
  expect(saved).toMatchObject({ config: { trend: { timeBucket: "Weekly" } } });
});

test("partition exports retain archived months when historical identities link", async ({
  page,
}) => {
  const fixture = await projectFixture(page, "Partition E2E");
  const prior = new Date();
  prior.setUTCMonth(prior.getUTCMonth() - 1, 10);
  const old = new Date();
  old.setUTCMonth(old.getUTCMonth() - 14, 10);
  const ingest = async (events: unknown[]) => {
    const response = await page.request.post("/api/ingest", {
      headers: { "X-API-KEY": fixture.key },
      data: { requestId: crypto.randomUUID(), events },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  };
  await ingest([
    event("current", { sessionId: "link" }),
    event("old", { sessionId: "link", timestamp: old.toISOString() }),
    event("unchanged", { timestamp: prior.toISOString() }),
  ]);
  const schema = z.array(
    z.object({
      partition: z.string(),
      checksum: z.string(),
      eventCount: z.number(),
      name: z.string(),
      url: z.string(),
    }),
  );
  const before = schema.parse(
    await (
      await page.request.post(`/api/${fixture.project}/events/catalog/gen`)
    ).json(),
  );
  expect(before).toHaveLength(2);
  expect(before.map((file) => file.partition)).toContain(
    old.toISOString().slice(0, 7),
  );
  await ingest([
    event("identify", { sessionId: "link", personId: "linked-person" }),
  ]);
  const after = schema.parse(
    await (
      await page.request.post(`/api/${fixture.project}/events/catalog/gen`)
    ).json(),
  );
  // Both months are past the archive grace week: they keep the attribution
  // they were archived with, while SQLite-held months rebuild on identity links.
  expect(after.map((file) => [file.partition, file.checksum])).toEqual(
    before.map((file) => [file.partition, file.checksum]),
  );
  const original = before[0];
  if (!original) throw new Error("Missing export");
  expect((await page.request.get(original.url)).ok()).toBeTruthy();
  await page.route(
    `**/api/${fixture.project}/events/snapshot`,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Catalog temporarily unavailable" }),
      }),
    { times: 1 },
  );
  await page.goto(`/app/${fixture.project}/queries`);
  await expect(page.getByRole("alert")).toContainText(
    "Unable to load analytics",
  );
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await page
    .locator(".cm-content")
    .fill("SELECT count(*) AS loaded FROM events");
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "4", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Data Manager", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page
    .locator(".cm-content")
    .fill(
      `SELECT event_type FROM events WHERE timestamp >= '${old.toISOString().slice(0, 7)}-01' AND timestamp < '${prior.toISOString().slice(0, 7)}-01'`,
    );
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "old", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "current", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".cm-content")
    .fill(
      "SELECT count(*) AS linked FROM events WHERE person_id='linked-person'",
    );
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  // The archived "old" event keeps its original attribution.
  await expect(
    page.getByRole("cell", { name: "2", exact: true }),
  ).toBeVisible();
});

test("create insight and dashboard, manage membership, then logout and login", async ({
  page,
}) => {
  const fixture = await projectFixture(page, "Creation E2E");
  const ingested = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": fixture.key },
    data: {
      requestId: crypto.randomUUID(),
      events: [
        event("membership-visible", {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        }),
      ],
    },
  });
  expect(ingested.ok(), await ingested.text()).toBeTruthy();
  await page.goto(`/app/${fixture.project}/insights`);
  await page
    .getByRole("button", { name: "Create New Insight", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/app/${fixture.project}/insights/\\d+/edit$`),
  );
  await page
    .getByRole("button", { name: "Rename Untitled trend", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Insight name", exact: true })
    .fill("UI-created insight");
  await page
    .getByRole("textbox", { name: "Insight name", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Rename UI-created insight",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Dashboards", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Create New Dashboard", exact: true })
    .click();
  await page
    .getByPlaceholder("Dashboard name", { exact: true })
    .fill("UI-created dashboard");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await page
    .getByRole("link", { name: "UI-created dashboard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Manage Insights", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Add a chart", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Search charts", exact: true })
    .fill("UI-created insight");
  await page
    .getByRole("option", { name: "UI-created insight", exact: true })
    .click();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "UI-created insight", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("img", { name: "UI-created insight", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Manage Insights", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove UI-created insight", exact: true })
    .click();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "UI-created insight", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /migration@example.com/ }).click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/projects")).status()).toBe(401);
  await page.getByLabel("Email", { exact: true }).fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  authenticatedCookies = await page.context().cookies();
});

test("invalid ingestion is rejected without partial writes and browser errors remain readable", async ({
  page,
}) => {
  const fixture = await projectFixture(page, "Validation E2E");
  const origin = "https://validation.example";
  await page.request.post(`/api/${fixture.project}/settings`, {
    data: [{ key: "cors_origins", value: origin }],
  });
  const headers = {
    "X-API-KEY": fixture.key,
    Origin: origin,
    "Content-Type": "application/json",
  };
  const first = event("original", {
    sessionId: "locked",
    personId: "person-a",
  });
  const payload = { requestId: crypto.randomUUID(), events: [first] };
  expect(
    (
      await page.request.post("/api/ingest", { headers, data: payload })
    ).status(),
  ).toBe(200);
  const conflict = await page.request.post("/api/ingest", {
    headers,
    data: { ...payload, events: [event("changed")] },
  });
  expect(conflict.status()).toBe(409);
  expect(conflict.headers()["access-control-allow-origin"]).toBe(origin);
  const sessionConflict = await page.request.post("/api/ingest", {
    headers,
    data: {
      requestId: crypto.randomUUID(),
      events: [
        event("rollback"),
        event("reassign", { sessionId: "locked", personId: "person-b" }),
      ],
    },
  });
  expect(sessionConflict.status()).toBe(409);
  const invalid = await page.request.post("/api/ingest", {
    headers,
    data: {
      requestId: crypto.randomUUID(),
      events: [
        event("rollback"),
        event("invalid", { timestamp: "not-a-date" }),
      ],
    },
  });
  expect(invalid.status()).toBe(400);
  expect(invalid.headers()["access-control-allow-origin"]).toBe(origin);
  expect(
    (
      await page.request.post("/api/ingest", { headers, data: "{invalid-json" })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/ingest", {
        headers,
        data: " ".repeat(2_000_001),
      })
    ).status(),
  ).toBe(413);
  const rows = z
    .array(z.object({ eventType: z.string() }))
    .parse(
      await (await page.request.get(`/api/${fixture.project}/events`)).json(),
    );
  expect(rows).toEqual([{ eventType: "original" }]);
});

test("sidebar stays collapsed across navigation, reload and mobile", async ({
  page,
}) => {
  const { project } = await projectFixture(page, "Collapsed sidebar");
  await page.goto(`/app/${project}`);
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveCSS("border-radius", "12px");
    await expect(sidebar).not.toHaveCSS("box-shadow", "none");
    await expect(sidebar).toHaveCSS("width", "48px");
    const bounds = await sidebar.boundingBox();
    expect(bounds?.x).toBe(8);
    expect(bounds?.y).toBe(8);
    expect(bounds?.height).toBe(828);
    await expect(sidebar.locator("..")).toHaveCSS("width", "64px");
    await expect(
      page.getByRole("button", { name: "Toggle Sidebar" }),
    ).toHaveCount(0);
    await page.keyboard.press("Control+b");
    await page.keyboard.press("Meta+b");
    await expect(sidebar.locator("..")).toHaveCSS("width", "64px");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await sidebar.getByRole("link", { name: "Events", exact: true }).click();
    await expect(page).toHaveURL(`/app/${project}/events`);
    await page.reload();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator("..")).toHaveCSS("width", "64px");
    await sidebar.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(`/app/${project}`);
    await expect(
      page.getByRole("img", {
        name: /^Trend chart preview\. Illustrative sample only/,
      }),
    ).toBeVisible();
  }
});

test("S3 analytics use private range reads, refresh revisions, and isolate projects", async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing test origin");
  const fixture = await projectFixture(page, "S3 range reads");
  const events = Array.from({ length: 500 }, () =>
    event("range-event", {
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      properties: {
        payload: Array.from({ length: 45 }, () => crypto.randomUUID()).join(""),
      },
    }),
  );
  const ingest = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": fixture.key },
    data: { requestId: crypto.randomUUID(), events },
  });
  expect(ingest.ok(), await ingest.text()).toBeTruthy();
  const catalogSchema = z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      filesize: z.number(),
      checksum: z.string(),
      expiresAt: z.string(),
    }),
  );
  const catalog = catalogSchema.parse(
    await (
      await page.request.post(`/api/${fixture.project}/events/catalog/gen`)
    ).json(),
  );
  const file = catalog[0];
  if (!file) throw new Error("Missing S3 snapshot");
  const unsigned = new URL(file.url);
  unsigned.search = "";
  expect((await page.request.get(unsigned.toString())).status()).toBe(403);
  expect(
    (
      await page.request.get(
        `/api/${fixture.project}/events/download?file=${file.name}`,
      )
    ).status(),
  ).toBe(404);
  const tampered = new URL(file.url);
  tampered.pathname = tampered.pathname.replace(
    fixture.project,
    "another-project",
  );
  expect((await page.request.get(tampered.toString())).status()).toBe(403);
  const unauthenticated = await context.browser()?.newContext();
  if (!unauthenticated) throw new Error("Missing browser");
  try {
    expect(
      (
        await unauthenticated.request.get(
          `${baseURL}/api/${fixture.project}/events/catalog`,
        )
      ).status(),
    ).toBe(401);
  } finally {
    await unauthenticated.close();
  }
  await page.clock.install();
  const reads: { status: number; range: string | undefined; bytes: number }[] =
    [];
  context.on("response", (response) => {
    if (
      response.url().startsWith(unsigned.origin) &&
      response.url().includes(fixture.project) &&
      response.request().method() === "GET"
    )
      reads.push({
        status: response.status(),
        range: response.headers()["content-range"],
        bytes: Number(response.headers()["content-length"] ?? 0),
      });
  });
  await page.goto(`/app/${fixture.project}/queries`);
  await page
    .locator(".cm-content")
    .fill("SELECT count(*) AS total FROM events");
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "500", exact: true }),
  ).toBeVisible();
  expect(reads.length).toBeGreaterThan(0);
  expect(
    reads.every(
      (read) => read.status === 206 && read.range?.startsWith("bytes "),
    ),
  ).toBe(true);
  expect(reads.reduce((sum, read) => sum + read.bytes, 0)).toBeLessThan(
    file.filesize,
  );
  const update = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": fixture.key },
    data: { requestId: crypto.randomUUID(), events: [event("late-event")] },
  });
  expect(update.ok()).toBeTruthy();
  let statusRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith(`/api/${fixture.project}/events/snapshot`))
      statusRequests++;
  });
  await page.clock.fastForward(15_000);
  // Wait for the export publication, then exercise the next scheduled refresh.
  await page.request.post(`/api/${fixture.project}/events/catalog/gen`);
  await page.clock.fastForward(15_000);
  await expect(
    page.getByRole("cell", { name: "501", exact: true }),
  ).toBeVisible();
  expect(statusRequests).toBeGreaterThan(0);
  await page.reload();
  await page
    .locator(".cm-content")
    .fill("SELECT count(*) AS total FROM events");
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "501", exact: true }),
  ).toBeVisible();
  const other = await projectFixture(page, "S3 isolated project");
  await page.goto(`/app/${other.project}/queries`);
  await page
    .locator(".cm-content")
    .fill("SELECT count(*) AS total FROM events");
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "0", exact: true }),
  ).toBeVisible();
});

test("dashboard compares complete UTC periods without boundary overlap and keeps labels readable", async ({
  page,
}, testInfo) => {
  const { insight } = await import("../../packages/contracts/src/index");
  const fixture = await projectFixture(page, "Date boundaries E2E");
  const totalEvents = (await eventsHome(page, fixture.project)).find(
    (item) => item.type === "Value",
  );
  const other = await projectFixture(page, "Date boundaries isolated");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const day = 86400000;
  const midnight = today.getTime();
  const name = "demo.trend.task_completed_with_a_long_but_readable_event_name";
  const current = [midnight - 30 * day, midnight - 15 * day, midnight - 1];
  const previous = [midnight - 60 * day, midnight - 30 * day - 1];
  const ingest = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": fixture.key },
    data: {
      requestId: crypto.randomUUID(),
      events: [...current, ...previous, midnight - 60 * day - 1, midnight].map(
        (time) => event(name, { timestamp: new Date(time).toISOString() }),
      ),
    },
  });
  expect(ingest.ok(), await ingest.text()).toBeTruthy();
  const isolated = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": other.key },
    data: {
      requestId: crypto.randomUUID(),
      events: [
        event(name, { timestamp: new Date(midnight - 1).toISOString() }),
      ],
    },
  });
  expect(isolated.ok(), await isolated.text()).toBeTruthy();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/app/${fixture.project}`);
  const currentValue = page
    .getByText("Current period", { exact: true })
    .locator("..");
  const previousValue = page
    .getByText("Previous period", { exact: true })
    .locator("..");
  async function expectValues(currentCount: number, previousCount: number) {
    await expect(
      currentValue.getByText(String(currentCount), { exact: true }),
    ).toBeVisible();
    await expect(
      previousValue.getByText(String(previousCount), { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/^Error:/)).toHaveCount(0);
  }
  await expectValues(3, 2);
  await expect(page.getByLabel("Period change")).toContainText("+1 (+50%)");
  const trend = page.getByRole("img", {
    name: "Events over time",
    exact: true,
  });
  const dateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  await expect(trend).toContainText(
    dateFormat.format(new Date(midnight - 30 * day)),
  );
  await expect(trend).not.toContainText("T00:00:00.000Z");
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.reload();
  await expectValues(3, 2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  // Charts resize a frame after the viewport changes; measure settled bounds.
  await expect
    .poll(async () => (await trend.boundingBox())?.width ?? 0)
    .toBeGreaterThan(240);
  const chartBounds = await trend.boundingBox();
  const valueBounds = await currentValue.boundingBox();
  if (!chartBounds || !valueBounds) throw new Error("Missing dashboard cards");
  expect(chartBounds.width).toBeGreaterThan(240);
  expect(chartBounds.x + chartBounds.width).toBeLessThanOrEqual(390);
  expect(valueBounds.y).toBeGreaterThan(chartBounds.y + chartBounds.height);
  await page.screenshot({
    path: testInfo.outputPath("date-boundaries-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  const definitions = insight
    .array()
    .parse(
      await (await page.request.get(`/api/${fixture.project}/insights`)).json(),
    );
  const value = definitions.find((item) => item.id === totalEvents?.id);
  if (!value || value.type !== "Value")
    throw new Error("Missing value insight");
  for (const [duration, currentCount, previousCount] of [
    ["today", 1, 1],
    ["PT24H", 2, 0],
    [
      `${new Date(midnight - 30 * day).toISOString().slice(0, 10)} - ${new Date(midnight - day).toISOString().slice(0, 10)}`,
      3,
      2,
    ],
  ] as const) {
    const response = await page.request.put(
      `/api/${fixture.project}/insights/${value.id}`,
      {
        data: {
          ...value,
          config: { value: { ...value.config.value, duration } },
        },
      },
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    await page.reload();
    await expectValues(currentCount, previousCount);
  }
  expect(errors).toEqual([]);
});

test("bulk ingestion preserves schema promotion, sample limits, retries and rollback", async ({
  page,
}) => {
  const fixture = await projectFixture(page, "Bulk schema E2E");
  const headers = { "X-API-KEY": fixture.key };
  const start = Date.now() - 10000;
  const initial = Array.from({ length: 95 }, (_, index) =>
    event("bulk", {
      timestamp: new Date(start + index).toISOString(),
      properties: { sample: index, mixed: 1 },
    }),
  );
  const ingest = (events: unknown[], requestId = crypto.randomUUID()) =>
    page.request.post("/api/ingest", { headers, data: { requestId, events } });
  expect((await ingest(initial)).status()).toBe(200);
  const batch = Array.from({ length: 1000 }, (_, index) =>
    event("bulk", {
      timestamp: new Date(start + 1000 + index).toISOString(),
      properties: {
        sample: index % 150,
        mixed: index === 999 ? "promoted" : 1,
        nested: { active: true },
      },
      sessionId: `session-${index % 5}`,
      personId: `person-${index % 5}`,
      personProperties: { sequence: index },
    }),
  ).reverse();
  const requestId = crypto.randomUUID();
  expect(await (await ingest(batch, requestId)).json()).toMatchObject({
    committed: 1000,
    duplicates: 0,
  });
  expect(await (await ingest(batch, requestId)).json()).toMatchObject({
    committed: 1000,
    duplicates: 0,
  });
  expect(await (await ingest(batch)).json()).toMatchObject({
    committed: 0,
    duplicates: 1000,
  });
  const getSchema = async () =>
    z
      .record(
        z.string(),
        z.record(z.string(), z.object({ id: z.number(), type: z.string() })),
      )
      .parse(
        await (await page.request.get(`/api/${fixture.project}/schema`)).json(),
      );
  const schema = await getSchema();
  expect(schema.bulk).toMatchObject({
    sample: { type: "number" },
    mixed: { type: "json" },
    nested: { type: "json" },
  });
  const sample = schema.bulk?.sample;
  if (!sample) throw new Error("Missing sample schema");
  const values = z
    .array(z.string())
    .parse(
      await (
        await page.request.get(
          `/api/${fixture.project}/schema/prop/${sample.id}`,
        )
      ).json(),
    );
  expect(new Set(values)).toEqual(
    new Set(Array.from({ length: 100 }, (_, index) => String(index))),
  );
  const original = initial[0];
  if (!original) throw new Error("Missing original event");
  expect(
    (
      await ingest([
        event("rollback", {
          timestamp: new Date(start - 1).toISOString(),
          properties: { leaked: true },
        }),
        { ...original, eventType: "conflict" },
      ])
    ).status(),
  ).toBe(409);
  expect(await getSchema()).toEqual(schema);
  const persisted = z
    .array(z.object({ id: z.string() }))
    .parse(
      await (await page.request.get(`/api/${fixture.project}/events`)).json(),
    );
  expect(persisted).toHaveLength(1095);
  expect(new Set(persisted.map((row) => row.id))).toEqual(
    new Set([...initial, ...batch].map((row) => row.id)),
  );
  const other = await projectFixture(page, "Bulk schema isolation E2E");
  expect(
    await (await page.request.get(`/api/${other.project}/schema`)).json(),
  ).toEqual({});
});

test("bulk batches coalesce snapshots and the final batch publishes all committed events", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing test origin");
  const fixture = await projectFixture(page, "Bulk exports E2E");
  const { createClient } = await import("../../packages/tracker/src/index");
  const client = createClient({
    hostname: baseURL,
    apiKey: fixture.key,
    autoTrackPageviews: false,
  });
  const catalog = async () =>
    z
      .array(z.object({ name: z.string(), eventCount: z.number() }))
      .parse(
        await (
          await page.request.post(`/api/${fixture.project}/events/catalog/gen`)
        ).json(),
      );
  await client.send({
    eventType: "before",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  });
  const before = await catalog();
  expect(before.reduce((sum, file) => sum + file.eventCount, 0)).toBe(1);
  await client.sendBatch(
    [
      {
        eventType: "bulk",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        eventType: "bulk",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    {
      deferExport: true,
    },
  );
  expect(await catalog()).toEqual(before);
  await client.sendBatch(
    [
      {
        eventType: "bulk",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    { deferExport: true },
  );
  expect(await catalog()).toEqual(before);
  expect(
    z
      .array(z.unknown())
      .parse(
        await (await page.request.get(`/api/${fixture.project}/events`)).json(),
      ),
  ).toHaveLength(4);
  await client.send({
    eventType: "final",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
  });
  const after = await catalog();
  expect(after.reduce((sum, file) => sum + file.eventCount, 0)).toBe(5);
  expect(after.map((file) => file.name)).not.toEqual(
    before.map((file) => file.name),
  );
  expect(await catalog()).toEqual(after);
  await page.goto(`/app/${fixture.project}/queries`);
  await page
    .locator(".cm-content")
    .fill("SELECT count(*) AS committed_events FROM events");
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "5", exact: true }),
  ).toBeVisible();
});

test("breakdown aligns bars beside truncated labels and exposes full labels on hover and focus", async ({
  page,
}) => {
  const fixture = await projectFixture(page, "Breakdown layout");
  await eventsHome(page, fixture.project);
  const longLabel =
    "demo.breakdown.a_very_long_event_name_that_must_remain_readable_in_a_tooltip";
  const response = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": fixture.key },
    data: {
      requestId: crypto.randomUUID(),
      events: [longLabel, longLabel, "short"].map((name) =>
        event(name, {
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        }),
      ),
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  await page.goto(`/app/${fixture.project}`);
  const chart = page.getByRole("img", { name: "Event breakdown", exact: true });
  const label = chart.getByRole("button", { name: longLabel, exact: true });
  await expect(label).toBeVisible();
  await expect(chart).toContainText("2");
  await expect(chart).toContainText("short");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(label).toBeVisible();
    expect(
      await label.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBeTruthy();
    const badge = chart.getByText("2", { exact: true }).first();
    // Rows resize a frame after the viewport changes; compare settled positions.
    await expect
      .poll(async () => {
        const bounds = await label.boundingBox();
        const valueBounds = await badge.boundingBox();
        if (!bounds || !valueBounds) return Infinity;
        return Math.abs(
          valueBounds.y + valueBounds.height / 2 - bounds.y - bounds.height / 2,
        );
      })
      .toBeLessThan(2);
    const bounds = await label.boundingBox();
    const valueBounds = await badge.boundingBox();
    if (!bounds || !valueBounds) throw new Error("Missing chart bounds");
    expect(valueBounds.x).toBeGreaterThan(bounds.x + bounds.width);
    expect(
      await chart.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBeTruthy();
    await label.hover();
    await expect(page.getByRole("tooltip")).toHaveText(longLabel);
    await page.mouse.move(0, 0);
    await label.focus();
    await expect(page.getByRole("tooltip")).toHaveText(longLabel);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toBeHidden();
    const bar = chart.getByRole("button", {
      name: `${longLabel}: 2 events`,
      exact: true,
    });
    await bar.hover();
    await expect(page.getByRole("tooltip")).toHaveText(
      `${longLabel}: 2 events`,
    );
    await page.mouse.move(0, 0);
    await bar.focus();
    await expect(page.getByRole("tooltip")).toHaveText(
      `${longLabel}: 2 events`,
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).toBeHidden();
    await chart.screenshot({ path: `test-results/breakdown-${width}.png` });
  }
  await page.reload();
  await expect(label).toBeVisible();
  await expect(chart).toContainText("2");
});

test("project picker renames another project without switching and preserves errors", async ({
  page,
}) => {
  const active = await projectFixture(page, "Active rename project");
  const other = await projectFixture(page, "Other rename project");
  await page.goto(`/app/${active.project}/ingestion`);
  await page
    .getByRole("button", { name: "Select project", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Rename Other rename project", exact: true })
    .click();
  const name = page.getByLabel("Project name", { exact: true });
  await name.fill("Renamed other project");
  await page.route(`**/api/${other.project}/settings`, (route) =>
    route.fulfill({ status: 500, json: { error: "Rename unavailable" } }),
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Rename unavailable");
  await expect(name).toHaveValue("Renamed other project");
  await page.unroute(`**/api/${other.project}/settings`);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(`/app/${active.project}/ingestion`);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Select project", exact: true }),
  ).toContainText("Active rename project");
  await page
    .getByRole("button", { name: "Select project", exact: true })
    .click();
  await page
    .getByRole("menuitem")
    .filter({ has: page.getByText("Renamed other project", { exact: true }) })
    .click();
  await expect(page).toHaveURL(`/app/${other.project}/ingestion`);
  await expect(
    page.getByRole("button", { name: "Select project", exact: true }),
  ).toContainText("Renamed other project");
  await page
    .getByRole("button", { name: "Create ingestion key", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reveal ingestion key", exact: true }),
  ).toHaveCount(2);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Reveal ingestion key", exact: true }),
  ).toHaveCount(2);
});

test("allowed origins add and remove immediately with validation, persistence and isolation", async ({
  page,
}) => {
  const fixture = await projectFixture(page, "Origins list");
  const other = await projectFixture(page, "Isolated origins");
  await page.goto(`/app/${fixture.project}/ingestion`);
  const input = page.getByLabel("New origin", { exact: true });
  const add = page.getByRole("button", { name: "Add", exact: true });
  const remove = page.getByRole("button", {
    name: "Remove https://example.com",
    exact: true,
  });
  await expect(page.getByRole("button", { name: "Save origins" })).toHaveCount(
    0,
  );
  await input.fill("https://example.com/path");
  await add.click();
  await expect(page.getByRole("alert")).toContainText("without a path");
  await expect(remove).toHaveCount(0);
  await input.fill("https://example.com");
  await add.click();
  await expect(remove).toBeVisible();
  await expect(input).toHaveValue("");
  await input.fill("https://example.com");
  await add.click();
  await expect(page.getByRole("alert")).toContainText("already allowed");
  await expect(remove).toHaveCount(1);
  await page.reload();
  await expect(remove).toBeVisible();
  const ingest = () =>
    page.request.post("/api/ingest", {
      headers: { "X-API-KEY": fixture.key, Origin: "https://example.com" },
      data: { requestId: crypto.randomUUID(), events: [event("origin-list")] },
    });
  expect((await ingest()).status()).toBe(200);
  await page.route(`**/api/${fixture.project}/settings`, (route) =>
    route.fulfill({ status: 500, json: { error: "Origins unavailable" } }),
  );
  await remove.click();
  await expect(page.getByRole("alert")).toHaveText("Origins unavailable");
  await expect(remove).toBeVisible();
  await page.unroute(`**/api/${fixture.project}/settings`);
  await remove.click();
  await expect(remove).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("No allowed origins added.")).toBeVisible();
  expect((await ingest()).status()).toBe(403);
  await page.goto(`/app/${other.project}/ingestion`);
  await expect(page.getByText("No allowed origins added.")).toBeVisible();
});
