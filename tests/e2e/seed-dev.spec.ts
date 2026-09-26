import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import {
  project,
  dashboard,
  storedEvent,
  insight,
} from "../../packages/contracts/src/index";
const exec = promisify(execFile);

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
  const setup = z
    .object({ adminRegistered: z.boolean() })
    .parse(await (await page.request.get("/api/setup")).json());
  const login = await page.request.post(
    `/api/auth/${setup.adminRegistered ? "sign-in" : "sign-up"}/email`,
    { headers: { Origin: origin }, data: credentials },
  );
  expect(login.ok(), await login.text()).toBeTruthy();
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
  expect(result.stdout).toMatch(/Imported in [\d.]+s \([\d,]+ events\/s\)/);
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
    "Daily workspace visits and completed tasks",
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

  const events = storedEvent
    .array()
    .parse(await (await page.request.get(`/api/${demo.id}/events`)).json());
  expect(events.length).toBeGreaterThan(500);
  expect(new Set(events.map((item) => item.properties.chart_target))).toEqual(
    new Set(["trend", "value", "breakdown", "funnel", "retention", "path"]),
  );
  expect(events.every((item) => item.timestamp.getTime() < Date.now())).toBe(
    true,
  );
  const count = (name: string) =>
    events.filter((item) => item.eventType === name).length;
  expect(count("demo.funnel.pricing_viewed")).toBe(40);
  expect(count("demo.funnel.subscription_started")).toBeGreaterThan(0);
  expect(count("demo.funnel.subscription_started")).toBeLessThan(
    count("demo.funnel.trial_started"),
  );
  expect(
    new Set(
      events
        .filter((item) => item.eventType === "demo.breakdown.feature_used")
        .map((item) => item.properties.feature),
    ).size,
  ).toBeGreaterThan(3);
  // Read back ingested profiles: every chart family can be filtered using
  // tracker-compatible dimensions, with stable values for returning actors.
  for (const property of [
    "browser",
    "os",
    "userAgent",
    "deviceType",
    "plan",
    "country",
    "source",
  ]) {
    expect(
      events.every((event) => typeof event.properties[property] === "string"),
    ).toBe(true);
    expect(
      new Set(events.map((event) => event.properties[property])).size,
    ).toBeGreaterThan(1);
  }
  const profiles = new Map<string, string>();
  for (const event of events) {
    expect(event.properties.deviceType).toBe(event.properties.device);
    const profile = JSON.stringify([
      event.properties.browser,
      event.properties.os,
      event.properties.userAgent,
      event.properties.device,
      event.properties.plan,
      event.properties.country,
      event.properties.source,
    ]);
    if (!event.personId) throw new Error("Seed event is missing its actor");
    const previous = profiles.get(event.personId);
    if (previous !== undefined) expect(profile).toBe(previous);
    profiles.set(event.personId, profile);
  }
  const safariEvents = events.filter(
    (event) => event.properties.browser === "Safari",
  );
  expect(safariEvents.length).toBeGreaterThan(0);
  expect(safariEvents.length).toBeLessThan(events.length);
  expect(
    new Set(safariEvents.map((event) => event.properties.chart_target)),
  ).toEqual(
    new Set(["trend", "value", "breakdown", "funnel", "retention", "path"]),
  );
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem("vite-ui-theme", "light"),
  );
  await page.goto(`/app/${demo.id}/dashboards/${playground.id}`);
  for (const name of [
    "Daily workspace visits and completed tasks",
    "Feature adoption",
    "Pricing to paid subscription",
    "Workspace retention by signup cohort",
    "Journeys from the home page",
  ])
    await expect(page.getByRole("img", { name, exact: true })).toBeVisible();
  await expect(page.getByText(/^Error:/)).toHaveCount(0);
  const trendChart = page.getByRole("img", {
    name: "Daily workspace visits and completed tasks",
    exact: true,
  });
  await expect(trendChart).toContainText(/[A-Z][a-z]{2} \d{1,2}/);
  await expect(trendChart).not.toContainText(/T00:00:00/);
  const chartBounds = await trendChart.boundingBox();
  if (!chartBounds) throw new Error("Trend chart has no bounds");
  const pointer = {
    x: chartBounds.x + chartBounds.width / 2,
    y: chartBounds.y + 40,
  };
  await page.mouse.move(pointer.x, pointer.y);
  const popup = page.locator(".analytics-tooltip:visible");
  await expect(popup).toHaveCount(1);
  await expect(popup).toContainText("Workspace visits");
  await expect(popup).toContainText("Tasks completed");
  const dateText = await popup.locator(".ts-chart-tooltip__title").innerText();
  const day = new Date(`${dateText} UTC`).toISOString().slice(0, 10);
  for (const { name, eventType } of [
    { name: "Workspace visits", eventType: "demo.trend.workspace_opened" },
    { name: "Tasks completed", eventType: "demo.trend.task_completed" },
  ]) {
    const expected = events.filter(
      (event) =>
        event.eventType === eventType &&
        event.timestamp.toISOString().startsWith(day),
    ).length;
    await expect(
      popup.locator(".ts-chart-tooltip__row").filter({ hasText: name }),
    ).toContainText(expected.toLocaleString("en-US"));
  }
  const popupBounds = await popup.boundingBox();
  if (!popupBounds) throw new Error("Tooltip has no bounds");
  expect(Math.abs(popupBounds.y - pointer.y)).toBeLessThan(150);
  await page.screenshot({ path: "test-results/shared-chart-tooltip.png" });
  // Moving vertically should retain the same x bucket and both series.
  await page.mouse.move(pointer.x, pointer.y + 90);
  await expect(popup.locator(".ts-chart-tooltip__title")).toHaveText(dateText);
  await expect(popup.locator(".ts-chart-tooltip__row")).toHaveCount(2);
  await page.mouse.move(0, 0);
  await expect(popup).toHaveCount(0);

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
        event.eventType === "demo.value.invoice_paid" &&
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
  const after = storedEvent
    .array()
    .parse(await (await page.request.get(`/api/${demo.id}/events`)).json());
  expect(
    after.some(
      (item) => item.timestamp.getTime() < Date.now() - 300 * 86400000,
    ),
  ).toBe(true);
  expect(new Set(after.map((item) => item.properties.demo_run)).size).toBe(2);
  expect(
    project
      .array()
      .parse(await (await page.request.get("/api/projects")).json()),
  ).toHaveLength(projects.length);
});
