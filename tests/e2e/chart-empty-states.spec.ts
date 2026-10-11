import { test, expect } from "@playwright/test";
import { z } from "zod";
import {
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";
import { loginAsAdmin } from "../support/auth";

test("illustrative previews cover every chart, persist without sample data, and give way to real results", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(240000);
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const created = project.parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Empty chart previews" },
      })
    ).json(),
  );
  const base = `/api/${created.id}/insights`;
  const savedInsights: z.infer<typeof insight>[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const definition of Object.values(defaultInsights)) {
    const response = await page.request.post(base, {
      data: { ...definition, name: `Preview ${definition.type}` },
    });
    expect(response.ok()).toBeTruthy();
    let saved = insight.parse(await response.json());
    const url = `/app/${created.id}/insights/${saved.id}`;
    await page.goto(url);
    const preview = page.getByRole("img", {
      name: new RegExp(`${saved.type} chart preview`),
    });
    await expect(preview).toBeVisible();
    await expect(preview).toHaveAccessibleName(/Illustrative sample only/);
    await expect(preview.locator("svg rect").first()).toBeAttached();
    await expect(preview.locator("button, [tabindex]")).toHaveCount(0);
    await preview.hover();
    await expect(page.locator(".analytics-tooltip")).toHaveCount(0);
    if (saved.type === "Funnel") {
      await expect(preview).toContainText("Add steps");
      saved.config.funnel.steps = ["signup", "purchase"].map((name, order) => ({
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
      }));
    }
    if (saved.type === "Trend") {
      saved.config.trend.series = (saved.config.trend.series ?? []).map(
        (series) => ({ ...series, visualisation: "bar" }),
      );
    }
    const update = await page.request.put(`${base}/${saved.id}`, {
      data: saved,
    });
    expect(update.ok()).toBeTruthy();
    saved = insight.parse(await update.json());
    savedInsights.push(saved);
    await page.reload();
    await expect(preview).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(preview).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: `output/empty-${saved.type.toLowerCase()}-mobile.png`,
      fullPage: true,
    });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expect(preview).toBeVisible();
    await page.screenshot({
      path: `output/empty-${saved.type.toLowerCase()}-dark.png`,
      fullPage: true,
    });
    await page.evaluate(() =>
      document.documentElement.classList.remove("dark"),
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    // An absent grouping field must use the same chart-specific preview.
    const grouped = {
      ...saved,
      breakdownBy: { name: "device", type: "string", isProperty: true },
    };
    expect(
      (await page.request.put(`${base}/${saved.id}`, { data: grouped })).ok(),
    ).toBeTruthy();
    await page.reload();
    await expect(preview).toBeVisible();
    expect(
      (await page.request.put(`${base}/${saved.id}`, { data: saved })).ok(),
    ).toBeTruthy();
    expect(
      insight.parse(
        await (await page.request.get(`${base}/${saved.id}`)).json(),
      ),
    ).toEqual(saved);
  }
  const dashboard = z.object({ id: z.number() }).parse(
    await (
      await page.request.post(`/api/${created.id}/dashboards`, {
        data: { name: "Empty previews", favorite: false },
      })
    ).json(),
  );
  expect(
    (
      await page.request.put(
        `/api/${created.id}/dashboards/${dashboard.id}/insights`,
        { data: { insight_ids: savedInsights.map((entry) => entry.id) } },
      )
    ).ok(),
  ).toBeTruthy();
  await page.goto(`/app/${created.id}/dashboards/${dashboard.id}`);
  await expect(page.locator("[data-chart-preview]")).toHaveCount(
    savedInsights.length,
  );
  await page.screenshot({
    path: "output/empty-chart-dashboard.png",
    fullPage: true,
  });
  const keys = z
    .array(z.object({ key: z.string() }))
    .parse(
      await (await page.request.post(`/api/${created.id}/apikeys`)).json(),
    );
  const key = keys.at(-1)?.key;
  if (!key) throw new Error("Missing API key");
  const ingested = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key },
    data: {
      requestId: crypto.randomUUID(),
      events: ["signup", "purchase"].map((eventType, index) => ({
        id: crypto.randomUUID(),
        eventType,
        personId: "preview-person",
        sessionId: "preview-session",
        timestamp: new Date(Date.now() - (3 - index) * 86400000).toISOString(),
        properties: { amount: 0 },
      })),
    },
  });
  expect(ingested.ok(), await ingested.text()).toBeTruthy();
  for (const saved of savedInsights) {
    await page.goto(`/app/${created.id}/insights/${saved.id}`);
    // Wait for observable results, not just disappearance during loading.
    if (saved.type === "Value")
      await expect(
        page.getByLabel("Current value", { exact: true }),
      ).toHaveText("2");
    else if (saved.type === "Breakdown")
      await expect(
        page.getByRole("cell", { name: "signup", exact: true }),
      ).toBeVisible();
    else if (saved.type === "Funnel")
      await expect(
        page.getByRole("table", { name: "Funnel results" }),
      ).toContainText("100.0%");
    else
      await expect(
        page.getByRole("img", { name: saved.name ?? "", exact: true }),
      ).toBeVisible();
    await expect(page.locator("[data-chart-preview]")).toHaveCount(0);
    if (saved.type === "Value") {
      saved.config.value.series.query.aggregations = [
        {
          function: "SUM",
          field: { name: "amount", type: "number", isProperty: true },
          alias: "result_value",
        },
      ];
      expect(
        (await page.request.put(`${base}/${saved.id}`, { data: saved })).ok(),
      ).toBeTruthy();
      await page.reload();
      await expect(
        page.getByLabel("Current value", { exact: true }),
      ).toHaveText("0");
      await expect(page.locator("[data-chart-preview]")).toHaveCount(0);
    }
  }
  expect(errors).toEqual([]);
});
