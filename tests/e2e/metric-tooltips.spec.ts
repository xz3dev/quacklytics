import { loginAsAdmin } from "../support/auth";
import { test, expect } from "@playwright/test";
import { z } from "zod";
import {
  defaultInsights,
  insight,
  project,
  aggregation,
} from "../../packages/contracts/src/index";

test("tooltips derive units per metric and preserve them after editing and reloading", async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const createdProject = project.parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Breakdown charts" },
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

  const ingested = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key },
    data: {
      requestId: crypto.randomUUID(),
      events: ["a", "a", "b"].map((personId, i) => ({
        id: crypto.randomUUID(),
        personId,
        sessionId: `session-${i}`,
        eventType: "purchase",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        properties: { amount: 10.5, person_id: personId },
      })),
    },
  });
  expect(ingested.ok(), await ingested.text()).toBeTruthy();
  const metrics: {
    name: string;
    aggregation: z.infer<typeof aggregation>;
    expected: string;
    person?: string;
  }[] = [
    {
      name: "People",
      aggregation: {
        function: "COUNT",
        field: { name: "person_id", type: "string" },
        distinct: true,
      },
      expected: "2 users",
    },
    {
      name: "One person",
      aggregation: {
        function: "COUNT",
        field: { name: "person_id", type: "string" },
        distinct: true,
      },
      person: "b",
      expected: "1 user",
    },
    {
      name: "Visits",
      aggregation: {
        function: "COUNT",
        field: { name: "session_id", type: "string" },
        distinct: true,
      },
      expected: "3 sessions",
    },
    {
      name: "One visit",
      aggregation: {
        function: "COUNT",
        field: { name: "session_id", type: "string" },
        distinct: true,
      },
      person: "b",
      expected: "1 session",
    },
    {
      name: "Filtered events",
      aggregation: { function: "COUNT", field: { name: "id", type: "string" } },
      person: "a",
      expected: "2 events",
    },
    {
      name: "One event",
      aggregation: { function: "COUNT", field: { name: "id", type: "string" } },
      person: "b",
      expected: "1 event",
    },
    {
      name: "Amount",
      aggregation: {
        function: "AVG",
        field: { name: "amount", type: "number", isProperty: true },
      },
      expected: "10.5",
    },
    {
      name: "Property IDs",
      aggregation: {
        function: "COUNT",
        field: { name: "person_id", type: "string", isProperty: true },
        distinct: true,
      },
      expected: "2",
    },
    {
      name: "Non-distinct IDs",
      aggregation: {
        function: "COUNT",
        field: { name: "person_id", type: "string" },
      },
      expected: "3",
    },
  ];
  const response = await page.request.post(
    `/api/${createdProject.id}/insights`,
    {
      data: {
        ...defaultInsights.Trend,
        name: "Metric units",
        config: {
          trend: {
            ...defaultInsights.Trend.config.trend,
            series: metrics.map((metric) => ({
              name: metric.name,
              visualisation: "bar",
              query: {
                aggregations: [
                  { ...metric.aggregation, alias: "result_value" },
                ],
                filters: metric.person
                  ? [
                      {
                        field: { name: "person_id", type: "string" },
                        operator: "=",
                        value: metric.person,
                      },
                    ]
                  : [],
              },
            })),
          },
        },
      },
    },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  const saved = insight.parse(await response.json());
  await page.goto(`/app/${createdProject.id}/insights/${saved.id}`);
  const chart = page.getByRole("img", { name: "Metric units", exact: true });
  const bars = chart.locator(".ts-chart__bar-y rect");
  const tooltip = page
    .getByRole("status")
    .and(page.locator(".analytics-tooltip"));
  await expect(bars).toHaveCount(metrics.length);
  for (const [index, metric] of metrics.entries()) {
    await bars.nth(index).hover();
    await expect(tooltip).toHaveAccessibleName(
      new RegExp(`${metric.name}: ${metric.expected.replace(".", "\\.")}$`),
    );
  }
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByRole("button", { name: "Distinct Users", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Count", exact: true }).click();
  await bars.first().hover();
  await expect(tooltip).toHaveAccessibleName(/People: 3 events$/);
  const save = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/insights/${saved.id}`) &&
      r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await save).ok()).toBeTruthy();
  await page.reload();
  await bars.first().hover();
  await expect(tooltip).toHaveAccessibleName(/People: 3 events$/);
  await bars.nth(1).hover();
  await expect(tooltip).toHaveAccessibleName(/One person: 1 user$/);
  const users = {
    function: "COUNT",
    field: { name: "person_id", type: "string" },
    distinct: true,
    alias: "result_value",
  };
  const valueResponse = await page.request.post(
    `/api/${createdProject.id}/insights`,
    {
      data: {
        ...defaultInsights.Value,
        name: "Grouped users",
        breakdownBy: { name: "event_type", type: "string" },
        config: {
          value: {
            ...defaultInsights.Value.config.value,
            series: { query: { aggregations: [users] } },
          },
        },
      },
    },
  );
  expect(valueResponse.ok()).toBeTruthy();
  const valueInsight = insight.parse(await valueResponse.json());
  await page.goto(`/app/${createdProject.id}/insights/${valueInsight.id}`);
  const valueBars = page
    .getByRole("img", { name: "Grouped users", exact: true })
    .locator(".ts-chart__bar-y rect");
  await expect(valueBars).toHaveCount(2);
  await valueBars.first().hover();
  await expect(tooltip).toHaveAccessibleName(/Value · purchase: 2 users$/);
  // A zero-height bar is still a data point; hover its position on the baseline.
  const zero = await valueBars.nth(1).boundingBox();
  if (!zero) throw new Error("Missing previous-value bar");
  await page.mouse.move(zero.x + zero.width / 2, zero.y);
  await expect(tooltip).toHaveAccessibleName(/Value · purchase: 0 users$/);

  const breakdownResponse = await page.request.post(
    `/api/${createdProject.id}/insights`,
    {
      data: {
        ...defaultInsights.Breakdown,
        name: "User breakdown",
        config: {
          breakdown: {
            ...defaultInsights.Breakdown.config.breakdown,
            aggregation: users,
          },
        },
      },
    },
  );
  expect(breakdownResponse.ok()).toBeTruthy();
  const breakdownInsight = insight.parse(await breakdownResponse.json());
  await page.goto(`/app/${createdProject.id}/insights/${breakdownInsight.id}`);
  await expect(
    page.getByRole("columnheader", { name: "Users", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "purchase: 2 users", exact: true })
    .hover();
  await expect(page.getByRole("tooltip")).toHaveText("purchase: 2 users");
  if (breakdownInsight.type !== "Breakdown")
    throw new Error("Expected breakdown");
  breakdownInsight.config.breakdown.aggregation = {
    function: "AVG",
    field: { name: "amount", type: "number", isProperty: true },
    alias: "result_value",
  };
  expect(
    (
      await page.request.put(
        `/api/${createdProject.id}/insights/${breakdownInsight.id}`,
        { data: breakdownInsight },
      )
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole("columnheader", { name: "Value", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "purchase: 10.5", exact: true })
    .hover();
  await expect(page.getByRole("tooltip")).toHaveText("purchase: 10.5");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
