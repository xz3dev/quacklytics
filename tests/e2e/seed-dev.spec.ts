import { loginAsAdmin } from "../support/auth";
import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import {
  project,
  dashboard,
  storedEvent,
  insight,
  analyticsSnapshot,
  parseJson,
} from "../../packages/contracts/src/index";
import type { Page } from "@playwright/test";
const exec = promisify(execFile);
// Reads what analytics query: published Parquet (the only copy of archived
// months) plus the SQLite rows the snapshot adds.
async function analyticsEvents(page: Page, projectId: string) {
  const snapshot = analyticsSnapshot.parse(
    await (await page.request.get(`/api/${projectId}/events/snapshot`)).json(),
  );
  const directory = mkdtempSync(join(tmpdir(), "quacklytics-seed-read-"));
  try {
    const paths: string[] = [];
    for (const file of snapshot.files) {
      const path = join(directory, file.name);
      writeFileSync(
        path,
        Buffer.from(await (await page.request.get(file.url)).body()),
      );
      paths.push(path);
    }
    const rows = paths.length
      ? z
          .array(
            z.object({
              id: z.string(),
              timestamp: z.number(),
              event_type: z.string(),
              session_id: z.string().nullable(),
              person_id: z.string().nullable(),
              properties: z.string(),
            }),
          )
          .parse(
            JSON.parse(
              (
                await exec(
                  "bun",
                  [
                    "-e",
                    `import { DuckDBInstance } from "@duckdb/node-api";
                    const conn = await (await DuckDBInstance.create()).connect();
                    const files = JSON.parse(Bun.argv.at(-1)).map((path) => "'" + path.replaceAll("'", "''") + "'");
                    const reader = await conn.runAndReadAll("SELECT id,epoch_ms(timestamp)::DOUBLE AS timestamp,event_type,session_id,person_id,properties::VARCHAR AS properties FROM read_parquet([" + files.join(",") + "])");
                    console.log(JSON.stringify(reader.getRowObjectsJS()));`,
                    JSON.stringify(paths),
                  ],
                  { cwd: resolve("apps/web"), maxBuffer: 256 * 1024 * 1024 },
                )
              ).stdout,
            ),
          )
          .map((row) => ({ ...row, properties: parseJson(row.properties) }))
      : [];
    return storedEvent.array().parse(
      [...rows, ...snapshot.liveEvents].map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        eventType: row.event_type,
        sessionId: row.session_id,
        personId: row.person_id,
        properties: row.properties,
      })),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("Bun demo command provisions real chart data and supports an existing ingestion key", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing test server origin");
  const origin = baseURL;
  const credentials = {
    email: "migration@example.com",
    password: "Migration-test-password-42",
    name: "Migration",
  };
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const result = await exec(
    "bun",
    [
      "run",
      "seed:dev",
      "--url",
      origin,
      "--email",
      credentials.email,
      "--users",
      "40",
      "--days",
      "60",
    ],
    {
      env: {
        ...process.env,
        QUACKLYTICS_PASSWORD: credentials.password,
        QUACKLYTICS_API_KEY: "",
      },
      timeout: 60000,
    },
  );
  expect(result.stdout).toContain("Open your demo dashboard:");
  expect(result.stdout).toMatch(/Imported in [\d.]+s \([\d,]+ operations\/s\)/);
  const sentCount = (stdout: string) =>
    z.coerce
      .number()
      .int()
      .positive()
      .parse(stdout.match(/Sending ([\d,]+) events/)?.[1]?.replaceAll(",", ""));
  const projects = project
    .array()
    .parse(await (await page.request.get("/api/projects")).json());
  const demo = projects.find((item) => item.name.startsWith("Demo "));
  if (!demo) throw new Error("Demo project not created");
  const exportedCount = async () => {
    expect(
      (await page.request.post(`/api/${demo.id}/events/catalog/gen`)).ok(),
    ).toBeTruthy();
    const files = z
      .array(z.object({ eventCount: z.number() }))
      .parse(
        await (await page.request.get(`/api/${demo.id}/events/catalog`)).json(),
      );
    return files.reduce((sum, file) => sum + file.eventCount, 0);
  };
  expect(await exportedCount()).toBe(sentCount(result.stdout));
  const dashboards = dashboard
    .array()
    .parse(await (await page.request.get(`/api/${demo.id}/dashboards`)).json());
  let playground = dashboards.find((item) => item.home);
  if (!playground) throw new Error("No home dashboard");
  expect(playground.name).toBe("Chart playground");
  expect(new Set(playground.insights.map((item) => item.type)).size).toBe(6);
  expect(playground.insights.map((item) => item.name)).toEqual([
    "Daily pageviews and completed tasks",
    "Revenue this month (EUR)",
    "Feature adoption",
    "Pricing to paid subscription",
    "Workspace retention by signup cohort",
    "Journeys from the home page",
  ]);
  if (process.env.E2E_DEV === "1") {
    await page.goto(`/app/${demo.id}/dashboards`);
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith("/dashboards/templates/chart_playground") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Chart playground (dev)", exact: true })
      .click();
    const response = await created;
    expect(response.ok(), await response.text()).toBeTruthy();
    playground = dashboard.parse(await response.json());
    expect(playground.insights).toHaveLength(6);
  }

  const events = await analyticsEvents(page, demo.id);
  expect(events.length).toBeGreaterThan(500);
  expect(events.every((item) => item.timestamp.getTime() < Date.now())).toBe(
    true,
  );
  const count = (name: string) =>
    events.filter((item) => item.eventType === name).length;
  // Read back what ingestion stored: the same shape real SDK traffic produces.
  const sdkContext = z.object({
    sdk: z.object({ name: z.literal("@quacklytics/client") }),
    page: z
      .object({
        url: z.string().startsWith("https://orbit.example/"),
        path: z.string().startsWith("/"),
        title: z.string().min(1),
        referrer: z.string(),
        pageViewId: z.uuid(),
        previousUrl: z.string().optional(),
      })
      .optional(),
    browser: z.string().optional(),
    os: z.string().optional(),
    deviceType: z.enum(["desktop", "mobile", "tablet"]).optional(),
    language: z.string().optional(),
    timezone: z.string().optional(),
  });
  const parsed = events.map((event) => ({
    ...event,
    context: sdkContext.parse(event.properties.$context),
  }));
  const browserEvents = parsed.filter((event) => event.context.page);
  const serverEvents = parsed.filter((event) => !event.context.page);
  expect(count("$pageview")).toBeGreaterThan(count("signed_up"));
  expect(count("$click")).toBeGreaterThan(0);
  for (const event of browserEvents) {
    expect(event.sessionId).toBeTruthy();
    expect(event.personId).toMatch(/^(user|anonymous):/);
    expect(event.properties.$country).toMatch(/^[A-Z]{2}$/);
    expect(event.context.browser).toBeTruthy();
    if (event.eventType === "$click")
      expect(typeof event.properties.tagName).toBe("string");
  }
  // Billing comes from the server SDK: no page, browser or session.
  expect(new Set(serverEvents.map((event) => event.eventType))).toContain(
    "invoice_paid",
  );
  for (const event of serverEvents) {
    expect(event.personId).toMatch(/^user:usr_/);
    expect(event.sessionId).toBeNull();
    expect(event.properties.$country).toBeUndefined();
  }
  // A session belongs to one browser in one place.
  const sessionProfiles = new Map<string, string>();
  for (const event of browserEvents) {
    const profile = JSON.stringify([
      event.context.browser,
      event.context.os,
      event.context.deviceType,
      event.context.timezone,
      event.properties.$country,
    ]);
    const key = event.sessionId ?? "";
    expect(sessionProfiles.get(key) ?? profile).toBe(profile);
    sessionProfiles.set(key, profile);
  }
  for (const field of ["browser", "os", "deviceType"] as const)
    expect(
      new Set(browserEvents.map((event) => event.context[field])).size,
    ).toBeGreaterThan(1);
  // identify() attributes earlier anonymous browsing to the user who signed up.
  const signups = parsed.filter((event) => event.eventType === "signed_up");
  expect(signups).toHaveLength(40);
  const signedUp = new Set(signups.map((event) => event.personId));
  expect(signedUp.size).toBe(40);
  expect(
    browserEvents.some(
      (event) =>
        signedUp.has(event.personId) &&
        event.eventType === "$pageview" &&
        !event.context.page?.path.startsWith("/app"),
    ),
  ).toBe(true);
  const funnelUsers = (name: string) =>
    new Set(
      parsed
        .filter((event) => event.eventType === name)
        .map((event) => event.personId),
    ).size;
  const pricingVisitors = new Set(
    browserEvents
      .filter(
        (event) =>
          event.eventType === "$pageview" &&
          event.context.page?.path === "/pricing",
      )
      .map((event) => event.personId),
  ).size;
  expect(pricingVisitors).toBeGreaterThan(signedUp.size);
  expect(funnelUsers("subscription_started")).toBeGreaterThan(0);
  expect(funnelUsers("subscription_started")).toBeLessThan(signedUp.size);
  expect(
    new Set(
      events
        .filter((item) => item.eventType === "feature_used")
        .map((item) => item.properties.feature),
    ).size,
  ).toBeGreaterThan(3);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem("vite-ui-theme", "light"),
  );
  await page.goto(`/app/${demo.id}/dashboards/${playground.id}`);
  for (const name of [
    "Daily pageviews and completed tasks",
    "Feature adoption",
    "Pricing to paid subscription",
    "Workspace retention by signup cohort",
    "Journeys from the home page",
  ])
    await expect(page.getByRole("img", { name, exact: true })).toBeVisible();
  await expect(page.getByText(/^Error:/)).toHaveCount(0);
  const trendChart = page.getByRole("img", {
    name: "Daily pageviews and completed tasks",
    exact: true,
  });
  await expect(trendChart).toContainText(/[A-Z][a-z]{2} \d{1,2}/);
  await expect(trendChart).not.toContainText(/T00:00:00/);
  const popup = page.locator(".analytics-tooltip:visible");
  await expect(trendChart.locator(".ts-chart__line path")).toHaveCount(1);
  // Tooltips follow nearby rendered points. Inspect each series explicitly;
  // overlapping curves are still tested together below.
  for (const { name, eventType, mark } of [
    {
      name: "Pageviews",
      eventType: "$pageview",
      mark: trendChart.locator(".ts-chart__line path").first(),
    },
    {
      name: "Tasks completed",
      eventType: "task_completed",
      mark: trendChart.locator(".ts-chart__bar-y rect").first(),
    },
  ]) {
    await expect(mark).toBeVisible();
    await mark.scrollIntoViewIfNeeded();
    const pointer = await mark.evaluate((element) => {
      if (element instanceof SVGRectElement) {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + Math.min(1, rect.height / 2),
        };
      }
      if (!(element instanceof SVGPathElement))
        throw new Error("Expected trend line");
      const point = element.getPointAtLength(0);
      const matrix = element.getScreenCTM();
      if (!matrix) throw new Error("Missing chart transform");
      const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
      return { x: screen.x, y: screen.y };
    });
    await page.mouse.move(pointer.x, pointer.y);
    await expect(popup).toHaveCount(1);
    await expect(popup).toContainText(name);
    const dateText = await popup
      .locator(".ts-chart-tooltip__title")
      .innerText();
    const day = new Date(`${dateText} UTC`).toISOString().slice(0, 10);
    const expected = events.filter(
      (event) =>
        event.eventType === eventType &&
        event.timestamp.toISOString().startsWith(day),
    ).length;
    await expect(
      popup.locator(".ts-chart-tooltip__row").filter({ hasText: name }),
    ).toContainText(
      `${expected.toLocaleString("en-US")} ${expected === 1 ? "event" : "events"}`,
    );
    const popupBounds = await popup.boundingBox();
    if (!popupBounds) throw new Error("Tooltip has no bounds");
    expect(Math.abs(popupBounds.y - pointer.y)).toBeLessThan(150);
    await page.mouse.move(0, 0);
    await expect(popup).toHaveCount(0);
  }

  const breakdownChart = page.getByRole("img", {
    name: "Feature adoption",
    exact: true,
  });
  await expect(breakdownChart).toContainText("Reports");
  const breakdownBefore = await breakdownChart.innerText();
  const savedInsights = await (
    await page.request.get(`/api/${demo.id}/insights`)
  ).json();
  const trendBefore = (await trendChart.textContent()) ?? "";
  const override = page.getByRole("button", { name: "Adjust", exact: true });
  await expect(
    page.getByText("Using each insight’s timeframe and grouping."),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Time grouping" }),
  ).toHaveCount(0);
  await override.click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(override).toBeVisible();
  await override.click();
  await page.getByRole("combobox", { name: "Time grouping" }).click();
  await page.getByRole("option", { name: "Month", exact: true }).click();
  await expect(trendChart).not.toHaveText(trendBefore);
  await page
    .getByRole("button", { name: "Insight timeframes", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Last 7 days", exact: true })
    .click();
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 7);
  const revenue = events
    .filter(
      (event) =>
        event.eventType === "invoice_paid" &&
        event.timestamp >= start &&
        event.timestamp < end,
    )
    .reduce((sum, event) => sum + z.number().parse(event.properties.amount), 0);
  const currentValue = page
    .getByText("Current period", { exact: true })
    .locator("..")
    .locator("span")
    .last();
  await expect(currentValue).toHaveText(revenue.toLocaleString("en-US"));
  await expect(breakdownChart).not.toHaveText(breakdownBefore, {
    useInnerText: true,
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(
    await (await page.request.get(`/api/${demo.id}/insights`)).json(),
  ).toEqual(savedInsights);
  await page
    .getByRole("button", { name: "Reset overrides", exact: true })
    .click();
  await expect(override).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Time grouping" }),
  ).toHaveCount(0);
  await expect(trendChart).toHaveText(trendBefore);
  await expect(breakdownChart).toHaveText(breakdownBefore, {
    useInnerText: true,
  });
  // Reload restores saved settings rather than persisting dashboard overrides.
  await override.click();
  await page
    .getByRole("button", { name: "Insight timeframes", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Last 7 days", exact: true })
    .click();
  await page.reload();
  await expect(override).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Insight timeframes", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reset overrides", exact: true }),
  ).toHaveCount(0);
  expect(
    await (await page.request.get(`/api/${demo.id}/insights`)).json(),
  ).toEqual(savedInsights);
  await expect(breakdownChart).toHaveText(breakdownBefore, {
    useInnerText: true,
  });
  await page.screenshot({
    path: "test-results/minimal-dashboard.png",
    fullPage: true,
  });
  await page.reload();
  await expect(breakdownChart).toHaveText(breakdownBefore, {
    useInnerText: true,
  });
  await expect(trendChart).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(trendChart).toBeVisible();
  const bounds = await trendChart.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds) expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/minimal-dashboard-mobile.png",
    fullPage: true,
  });
  // Identical curves must retain separate named rows, even at the same coordinates.
  const trendRef = playground.insights.find((item) => item.type === "Trend");
  if (!trendRef) throw new Error("Missing trend insight");
  const original = insight.parse(
    await (
      await page.request.get(`/api/${demo.id}/insights/${trendRef.id}`)
    ).json(),
  );
  if (original.type !== "Trend") throw new Error("Expected trend insight");
  const firstSeries = original.config.trend.series?.[0];
  if (!firstSeries) throw new Error("Missing trend series");
  const created = await page.request.post(`/api/${demo.id}/insights`, {
    data: {
      type: "Trend",
      name: "Overlapping curves",
      favorite: false,
      config: {
        trend: {
          ...original.config.trend,
          series: [
            { ...firstSeries, name: "Events", visualisation: "line" },
            { ...firstSeries, name: "Events (Copy)", visualisation: "line" },
          ],
        },
      },
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const overlapping = z.object({ id: z.number() }).parse(await created.json());
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/app/${demo.id}/insights/${overlapping.id}`);
  const overlappingChart = page.getByRole("img", {
    name: "Overlapping curves",
    exact: true,
  });
  await expect(overlappingChart).toBeVisible();
  await overlappingChart.hover();
  await expect(popup).toHaveCount(1);
  const overlappingRows = popup.locator(".ts-chart-tooltip__row");
  await expect(overlappingRows).toHaveCount(2);
  await expect(overlappingRows.nth(0)).toContainText("Events");
  await expect(overlappingRows.nth(1)).toContainText("Events (Copy)");
  const firstValue = await overlappingRows
    .nth(0)
    .locator("span")
    .last()
    .innerText();
  expect(firstValue).toMatch(/^\d/);
  await expect(overlappingRows.nth(1).locator("span").last()).toHaveText(
    firstValue,
  );
  await page.screenshot({ path: "test-results/overlapping-chart-tooltip.png" });
  await page.mouse.move(0, 0);
  await expect(popup).toHaveCount(0);
  expect(errors).toEqual([]);
  // Existing-key mode must add events without creating administrative resources.
  const keys = z
    .array(z.object({ key: z.string() }))
    .parse(await (await page.request.post(`/api/${demo.id}/apikeys`)).json());
  const key = keys.at(-1)?.key;
  if (!key) throw new Error("Missing ingestion key");
  const sent = await exec(
    "bun",
    ["run", "seed:dev", "--url", origin, "--users", "20"],
    { env: { ...process.env, QUACKLYTICS_API_KEY: key }, timeout: 60000 },
  );
  expect(sent.stdout).not.toContain("Created project:");
  expect(sent.stdout).toContain("365 days, seed 42");
  expect(await exportedCount()).toBe(
    sentCount(result.stdout) + sentCount(sent.stdout),
  );
  const after = await analyticsEvents(page, demo.id);
  expect(
    after.some(
      (item) => item.timestamp.getTime() < Date.now() - 300 * 86400000,
    ),
  ).toBe(true);
  // Each run signs up its own users rather than reusing the first run's.
  expect(
    new Set(
      after
        .filter((item) => item.eventType === "signed_up")
        .map((item) => item.personId),
    ).size,
  ).toBe(60);
  expect(
    project
      .array()
      .parse(await (await page.request.get("/api/projects")).json()),
  ).toHaveLength(projects.length);
});
