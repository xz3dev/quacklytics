import { loginAsAdmin } from "../support/auth";
import { test, expect } from "@playwright/test";
import { z } from "zod";
import {
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";

test("funnels default to unique users and persist changes to event counting", async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const createdProject = project.parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Funnel counting" },
      })
    ).json(),
  );
  const keys = z
    .array(z.object({ key: z.string() }))
    .parse(
      await (
        await page.request.post(`/api/${createdProject.id}/apikeys`)
      ).json(),
    );
  const key = keys.at(-1)?.key;
  if (!key) throw new Error("Missing API key");

  // Repeated events across sessions must count once per user. An early trial
  // and an out-of-range pricing event must not qualify for the funnel.
  const fixtures = [
    { person: 0, session: "a", eventType: "Started trial", hours: 100 },
    { person: 0, session: "a", eventType: "Viewed pricing", hours: 90 },
    { person: 0, session: "b", eventType: "Viewed pricing", hours: 80 },
    { person: 0, session: "b", eventType: "Started trial", hours: 70 },
    { person: 0, session: "c", eventType: "Started trial", hours: 60 },
    { person: 0, session: "c", eventType: "Subscribed", hours: 50 },
    { person: 1, session: "d", eventType: "Viewed pricing", hours: 90 },
    { person: 1, session: "d", eventType: "Started trial", hours: 70 },
    { person: 2, session: "e", eventType: "Viewed pricing", hours: 90 },
    { person: 3, session: "f", eventType: "Started trial", hours: 70 },
    { person: 3, session: "f", eventType: "Viewed pricing", hours: 24 * 40 },
  ];
  const ingested = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key },
    data: {
      requestId: crypto.randomUUID(),
      events: fixtures.map(({ person, session, eventType, hours }) => ({
        id: crypto.randomUUID(),
        personId: `person-${person}`,
        sessionId: session,
        eventType,
        timestamp: new Date(Date.now() - hours * 3600000).toISOString(),
        properties: { device: "desktop" },
      })),
    },
  });
  expect(ingested.ok(), await ingested.text()).toBeTruthy();
  const definition = Object.values(defaultInsights).find(
    (value) => value.type === "Funnel",
  );
  const configured = insight.parse({ ...definition, id: 1 });
  if (configured.type !== "Funnel")
    throw new Error("Missing funnel definition");
  configured.config.funnel.steps = ["Viewed pricing", "Started trial"].map(
    (name, order) => ({
      id: name,
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
    }),
  );
  // Omit the new field to exercise compatibility with existing saved funnels.
  const { countingMode: omittedMode, ...legacyConfig } =
    configured.config.funnel;
  expect(omittedMode).toBe("uniqueUsers");
  const response = await page.request.post(
    `/api/${createdProject.id}/insights`,
    {
      data: {
        ...configured,
        name: "Counting funnel",
        config: { funnel: legacyConfig },
      },
    },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  const saved = insight.parse(await response.json());
  if (saved.type !== "Funnel") throw new Error("Expected funnel");
  expect(saved.config.funnel.countingMode).toBe("uniqueUsers");
  const url = `/app/${createdProject.id}/insights/${saved.id}`;
  await page.goto(url);
  const table = page.getByRole("table", { name: "Funnel results" });
  const pricing = table.getByRole("row").filter({ hasText: "Viewed pricing" });
  const trial = table.getByRole("row").filter({ hasText: "Started trial" });
  await expect(
    table.getByRole("columnheader", { name: "Unique users" }),
  ).toBeVisible();
  await expect(pricing.getByRole("cell").nth(1)).toHaveText("3");
  await expect(trial.getByRole("cell")).toHaveText([
    "2Started trial",
    "2",
    "66.7%",
    "133.3% of previous",
    "66.7%",
    "20h",
  ]);
  const chart = page.getByRole("img", { name: "Counting funnel", exact: true });
  await chart.locator(".ts-chart__bar-y :is(rect, path)").first().hover();
  await expect(page.locator(".analytics-tooltip")).toContainText(
    "Unique users",
  );
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const selector = page.getByRole("combobox", {
    name: "Funnel counting method",
  });
  await expect(selector).toHaveText("Unique users");
  await selector.click();
  await page
    .getByRole("option", { name: "Unique sessions", exact: true })
    .click();
  await expect(
    table.getByRole("columnheader", { name: "Unique sessions" }),
  ).toBeVisible();
  await expect(pricing.getByRole("cell").nth(1)).toHaveText("4");
  await expect(trial.getByRole("cell")).toHaveText([
    "2Started trial",
    "2",
    "50.0%",
    "250.0% of previous",
    "50.0%",
    "15h",
  ]);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(url);
  await page.reload();
  await expect(trial.getByRole("cell").nth(2)).toHaveText("50.0%");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(selector).toHaveText("Unique sessions");
  await selector.click();
  await page.getByRole("option", { name: "Event count", exact: true }).click();
  await expect(
    table.getByRole("columnheader", { name: "Events", exact: true }),
  ).toBeVisible();
  await expect(pricing.getByRole("cell").nth(1)).toHaveText("4");
  await expect(trial.getByRole("cell")).toHaveText([
    "2Started trial",
    "3",
    "75.0%",
    "125.0% of previous",
    "75.0%",
    "20h",
  ]);
  await chart.locator(".ts-chart__bar-y :is(rect, path)").first().hover();
  await expect(page.locator(".analytics-tooltip")).toContainText("Events");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(url);
  await page.reload();
  await expect(trial.getByRole("cell").nth(1)).toHaveText("3");
  const persisted = insight.parse(
    await (
      await page.request.get(`/api/${createdProject.id}/insights/${saved.id}`)
    ).json(),
  );
  if (persisted.type !== "Funnel") throw new Error("Expected funnel");
  expect(persisted.config.funnel.countingMode).toBe("eventCount");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(selector).toHaveText("Event count");
  // The same counting method must apply when a breakdown is enabled.
  await page.getByRole("combobox", { name: "Break down by" }).click();
  await page.getByPlaceholder("Search field...").fill("device");
  await page.getByRole("option").filter({ hasText: "device" }).click();
  await expect(trial.getByRole("cell").nth(1)).toHaveText("3");
  await selector.click();
  await page.getByRole("option", { name: "Unique users", exact: true }).click();
  await expect(pricing.getByRole("cell").nth(1)).toHaveText("3");
  await expect(trial.getByRole("cell").nth(1)).toHaveText("2");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(url);
  await page.reload();
  await expect(
    table.getByRole("columnheader", { name: "Unique users" }),
  ).toBeVisible();
  await expect(trial.getByRole("cell").nth(2)).toHaveText("66.7%");
  const thirdStep = {
    id: "subscribed",
    name: "Subscribed",
    order: 2,
    query: {
      filters: [
        {
          field: { name: "event_type", type: "string" },
          operator: "=",
          value: "Subscribed",
        },
      ],
    },
  };
  const detailedResponse = await page.request.post(
    `/api/${createdProject.id}/insights`,
    {
      data: {
        ...configured,
        name: "Detailed funnel",
        config: {
          funnel: {
            ...configured.config.funnel,
            steps: [...(configured.config.funnel.steps ?? []), thirdStep],
          },
        },
      },
    },
  );
  expect(detailedResponse.ok(), await detailedResponse.text()).toBeTruthy();
  const detailed = insight.parse(await detailedResponse.json());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/app/${createdProject.id}/insights/${detailed.id}`);
  const subscribed = table.getByRole("row").filter({ hasText: "Subscribed" });
  await expect(subscribed.getByRole("cell")).toHaveText([
    "3Subscribed",
    "1",
    "33.3%",
    "150.0% of previous",
    "50.0%",
    "20h",
  ]);
  const detailChart = page.getByRole("img", {
    name: "Detailed funnel",
    exact: true,
  });
  await expect(detailChart.getByText("100%", { exact: true })).toBeVisible();
  await detailChart
    .locator(".ts-chart__bar-y :is(rect, path)[fill^='url(']")
    .last()
    .hover();
  const tooltip = page.locator(".analytics-tooltip");
  await expect(tooltip).toContainText("Step 3: Subscribed");
  await expect(tooltip).toContainText("Conversion from previous50.0%");
  await expect(tooltip).toContainText("Conversion from start33.3%");
  await expect(tooltip).toContainText(
    "Dropped off from previous1 user · 50.0%",
  );
  await expect(tooltip).toContainText("Dropped off from start2 users · 66.7%");
  await page.screenshot({
    path: "output/funnel-dropoff-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "output/funnel-dropoff-mobile.png",
    fullPage: true,
  });
  for (const scenario of [
    { name: "Repeated events", session: "a", expected: "200.0%" },
    { name: "Empty funnel", session: "no-such-session", expected: "—" },
  ]) {
    const response = await page.request.post(
      `/api/${createdProject.id}/insights`,
      {
        data: {
          ...configured,
          name: scenario.name,
          config: {
            funnel: {
              ...configured.config.funnel,
              countingMode: "eventCount",
              steps: configured.config.funnel.steps?.map((step, index) =>
                index === 0
                  ? {
                      ...step,
                      query: {
                        filters: [
                          ...(step.query.filters ?? []),
                          {
                            field: { name: "session_id", type: "string" },
                            operator: "=",
                            value: scenario.session,
                          },
                        ],
                      },
                    }
                  : step,
              ),
            },
          },
        },
      },
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const saved = insight.parse(await response.json());
    await page.goto(`/app/${createdProject.id}/insights/${saved.id}`);
    if (scenario.name === "Empty funnel") {
      await expect(
        page.getByRole("img", { name: /Funnel chart preview/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("table", { name: "Funnel results" }),
      ).toHaveCount(0);
      await expect(page.getByText(/NaN|Infinity/)).toHaveCount(0);
      continue;
    }
    await expect(trial.getByRole("cell").nth(2)).toHaveText(scenario.expected);
    const chart = page.getByRole("img", { name: scenario.name, exact: true });
    await expect(
      chart.locator(".ts-chart__bar-y :is(rect, path)[fill^='url(']"),
    ).toHaveCount(0);
    if (scenario.name === "Repeated events") {
      await expect(trial.getByRole("cell").nth(1)).toHaveText("2");
      await expect(chart.getByText("200%", { exact: true })).toBeVisible();
    } else {
      await expect(trial.getByRole("cell").nth(1)).toHaveText("0");
      await expect(trial.getByRole("cell").last()).toHaveText("—");
      await expect(page.getByText(/NaN|Infinity/)).toHaveCount(0);
    }
  }
});
