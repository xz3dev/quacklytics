import { loginAsAdmin } from "../support/auth";
import { test, expect, type Page, type Worker } from "@playwright/test";
import { z } from "zod";
import { analyticsSnapshot } from "../../packages/contracts/src/index";

async function project(page: Page, name: string) {
  const response = await page.request.post("/api/projects", { data: { name } });
  expect(response.ok()).toBeTruthy();
  const { id } = z.object({ id: z.string() }).parse(await response.json());
  const keys = z
    .array(z.object({ key: z.string() }))
    .parse(await (await page.request.post(`/api/${id}/apikeys`)).json());
  const key = keys.at(-1)?.key;
  if (!key) throw new Error("Missing key");
  return { id, key, name };
}
async function ingest(
  page: Page,
  key: string,
  eventType: string,
  deferExport = false,
) {
  const payload = {
    requestId: crypto.randomUUID(),
    deferExport,
    events: [
      {
        id: crypto.randomUUID(),
        eventType,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  const response = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key },
    data: payload,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return z.object({ revision: z.number() }).parse(await response.json());
}

test("session outages stay on the protected route and recover; only 401 redirects to login", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing origin");
  await loginAsAdmin(page, baseURL);
  await page.route("**/api/me", (route) =>
    route.fulfill({ status: 503, body: "Service unavailable" }),
  );
  await page.goto("/projects");
  await expect(page.getByRole("alert")).toContainText(
    "Unable to verify your session",
  );
  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/me");
  await page.getByRole("button", { name: "Retry session" }).click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await page.route("**/api/me", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Authentication required" }),
    }),
  );
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("freshness reports live SQLite events, refreshes results, and releases workers across project switches", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing origin");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const workers = new Set<Worker>();
  page.on("worker", (worker) => {
    if (!worker.url().includes("duckdb")) return;
    workers.add(worker);
    worker.on("close", () => workers.delete(worker));
  });
  await loginAsAdmin(page, baseURL);
  const first = await project(page, "Freshness first");
  const second = await project(page, "Freshness second");
  const committed = await ingest(page, first.key, "first-project");
  expect(
    (await page.request.get(`/api/${first.id}/events/catalog`)).ok(),
  ).toBeTruthy();
  const status = analyticsSnapshot.parse(
    await (await page.request.get(`/api/${first.id}/events/snapshot`)).json(),
  );
  expect(status).toMatchObject({
    committedRevision: committed.revision,
    exportedRevision: 0,
    pending: false,
    exportError: null,
  });
  expect(status.exportedAt).toBeNull();
  await page.goto(`/app/${first.id}/events`);
  await expect(
    page.getByRole("cell", { name: "first-project", exact: true }),
  ).toBeVisible();
  const widget = page.getByRole("button", {
    name: "Analytics data: Up to date",
    exact: true,
  });
  await expect(widget).toBeVisible();
  await expect(page.getByLabel("Analytics freshness")).toHaveCount(0);
  const switcherBox = await page
    .getByRole("button", { name: "Select project" })
    .boundingBox();
  const widgetBox = await widget.boundingBox();
  const homeBox = await page
    .getByRole("link", { name: "Home", exact: true })
    .boundingBox();
  if (!switcherBox || !widgetBox || !homeBox)
    throw new Error("Missing sidebar controls");
  expect(widgetBox.y).toBeGreaterThanOrEqual(
    switcherBox.y + switcherBox.height,
  );
  expect(widgetBox.y + widgetBox.height).toBeLessThanOrEqual(homeBox.y);
  expect(widgetBox.y - switcherBox.y - switcherBox.height).toBeCloseTo(
    homeBox.y - widgetBox.y - widgetBox.height,
    0,
  );
  await widget.click();
  // A healthy load shows only the timeframe and last check, no status message.
  await expect(widget).toBeVisible();
  await expect(page.getByLabel("Analytics freshness")).toContainText(
    "Last checked",
  );
  await expect(
    page.getByLabel("Analytics freshness").locator("[aria-live]"),
  ).toHaveCount(0);
  const timeframe = page.getByLabel("Available timeframe");
  await expect(
    page
      .getByLabel("Analytics freshness")
      .getByText("Analytics data", { exact: true }),
  ).toHaveCount(0);
  await expect(timeframe.locator("time").first()).toHaveAttribute(
    "dateTime",
    status.availableStart ?? "",
  );
  await expect(timeframe.locator("time").last()).toHaveAttribute(
    "dateTime",
    new Date(Date.parse(status.availableEnd ?? "") - 1).toISOString(),
  );
  await expect.poll(() => workers.size).toBe(1);
  await ingest(page, first.key, "pending-event", true);
  await page.getByRole("button", { name: "Refresh data", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "pending-event", exact: true }),
  ).toBeVisible();
  const published = await ingest(page, first.key, "flush-event");
  // The scheduled pending refresh picks up both new events without a reload.
  await expect(
    page.getByRole("cell", { name: "pending-event", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "flush-event", exact: true }),
  ).toBeVisible();
  // A healthy load shows only the timeframe and last check, no status message.
  await expect(widget).toBeVisible();
  await expect(page.getByLabel("Analytics freshness")).toContainText(
    "Last checked",
  );
  await expect(
    page.getByLabel("Analytics freshness").locator("[aria-live]"),
  ).toHaveCount(0);
  const updated = analyticsSnapshot.parse(
    await (await page.request.get(`/api/${first.id}/events/snapshot`)).json(),
  );
  expect(updated.committedRevision).toBe(published.revision);
  expect(updated.files).toHaveLength(0);

  // A failed refetch keeps loaded results and can be retried from the widget.
  await page.route(`**/api/${first.id}/events/snapshot`, (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.getByRole("button", { name: "Refresh data", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Analytics data: Needs attention",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Analytics freshness")).toContainText(
    "Analytics refresh failed",
  );
  await expect(
    page.getByRole("cell", { name: "pending-event", exact: true }),
  ).toBeVisible();
  await page.unroute(`**/api/${first.id}/events/snapshot`);
  await page.getByRole("button", { name: "Refresh data", exact: true }).click();
  await expect(widget).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Analytics freshness")).toHaveCount(0);
  await widget.click();

  // Keep an old project's catalog request in flight while navigating within the app.
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let waiting = false;
  await page.route(`**/api/${first.id}/events/snapshot`, async (route) => {
    waiting = true;
    await gate;
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(updated),
      })
      .catch(() => undefined);
  });
  await page.getByRole("button", { name: "Refresh data", exact: true }).click();
  await expect.poll(() => waiting).toBe(true);
  await page.getByRole("button", { name: "Select project" }).click();
  await page
    .getByRole("menuitem", { name: second.name, exact: false })
    .first()
    .click();
  release?.();
  await expect(page).toHaveURL(new RegExp(`/app/${second.id}/events`));
  await expect(page.getByText("No events yet.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Analytics data:/ }).click();
  await expect(timeframe).toContainText("No data available yet");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("cell", { name: "first-project", exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => workers.size).toBe(1);
  await page.unroute(`**/api/${first.id}/events/snapshot`);
  await page.getByRole("button", { name: "Select project" }).click();
  await page
    .getByRole("menuitem", { name: first.name, exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("cell", { name: "first-project", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect.poll(() => workers.size).toBe(1);
  await page.reload();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("leaving a project cancels a running SQL query and releases its browser worker", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing origin");
  await loginAsAdmin(page, baseURL);
  const first = await project(page, "Cancel query first");
  const second = await project(page, "Cancel query second");
  const workers = new Set<Worker>();
  page.on("worker", (worker) => {
    if (!worker.url().includes("duckdb")) return;
    workers.add(worker);
    worker.on("close", () => workers.delete(worker));
  });
  await page.goto(`/app/${first.id}/queries`);
  await page
    .locator(".cm-content")
    .fill("SELECT sum(sin(i)) AS expensive FROM range(1000000000) t(i)");
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(page.getByText("Running query…", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Select project" }).click();
  await page
    .getByRole("menuitem", { name: second.name, exact: false })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/${second.id}/queries`));
  await page
    .locator(".cm-content")
    .fill("SELECT count(*) AS isolated FROM events");
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "0", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "expensive", exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => workers.size).toBe(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("SQL renews expiring file access without deadlocking the first query", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing origin");
  await loginAsAdmin(page, baseURL);
  const created = await project(page, "Renew access");
  const payload = {
    requestId: crypto.randomUUID(),
    events: [
      {
        id: crypto.randomUUID(),
        eventType: "renewed",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
  };
  expect(
    (
      await page.request.post("/api/ingest", {
        headers: { "X-API-KEY": created.key },
        data: payload,
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (await page.request.post(`/api/${created.id}/events/catalog/gen`)).ok(),
  ).toBeTruthy();
  expect(
    (await page.request.get(`/api/${created.id}/events/catalog`)).ok(),
  ).toBeTruthy();
  let requests = 0;
  await page.route(`**/api/${created.id}/events/snapshot`, async (route) => {
    requests++;
    const response = await route.fetch();
    const status = analyticsSnapshot.parse(await response.json());
    // The object URL stays valid; only the first response's expiry metadata
    // is advanced to exercise renewal without waiting an hour in the browser.
    const files =
      requests === 1
        ? status.files.map((file) => ({
            ...file,
            expiresAt: new Date(Date.now() + 1000).toISOString(),
          }))
        : status.files;
    await route.fulfill({ response, json: { ...status, files } });
  });
  await page.goto(`/app/${created.id}/queries`);
  await page
    .locator(".cm-content")
    .fill("SELECT count(*) AS renewed_events FROM events");
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "1", exact: true }),
  ).toBeVisible();
  expect(requests).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
