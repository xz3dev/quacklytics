import { loginAsAdmin } from "../support/auth";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import {
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";

test("value bars compare real periods, handle zero baselines, and survive reload on mobile and dashboards", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const created = project.parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Value comparisons" },
      })
    ).json(),
  );
  const keys = z
    .array(z.object({ key: z.string() }))
    .parse(
      await (await page.request.post(`/api/${created.id}/apikeys`)).json(),
    );
  const key = keys.at(-1)?.key;
  if (!key) throw new Error("Missing API key");
  const cases = [
    { name: "Increase", current: 12, previous: 8, change: "+4 (+50%)" },
    { name: "Decrease", current: 4, previous: 8, change: "-4 (-50%)" },
    { name: "Empty", current: 0, previous: 0, change: "0No change" },
    { name: "New", current: 3, previous: 0, change: "+3vs. previous period" },
    { name: "Equal", current: 8, previous: 8, change: "0 (0%)No change" },
  ];
  const events = cases.flatMap((entry) =>
    [
      { count: entry.current, days: 2 },
      { count: entry.previous, days: 9 },
    ].flatMap(({ count, days }) =>
      Array.from({ length: count }, () => ({
        id: crypto.randomUUID(),
        eventType: entry.name,
        sessionId: crypto.randomUUID(),
        timestamp: new Date(Date.now() - days * 86400000).toISOString(),
        properties: {},
      })),
    ),
  );
  const ingested = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key },
    data: { requestId: crypto.randomUUID(), events },
  });
  expect(ingested.ok(), await ingested.text()).toBeTruthy();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const ids: number[] = [];
  for (const entry of cases) {
    const definition = insight.parse({ ...defaultInsights.Value, id: 1 });
    if (definition.type !== "Value") throw new Error("Expected value insight");
    definition.config.value.duration = "P7D";
    definition.config.value.series.query.filters = [
      {
        field: { name: "event_type", type: "string" },
        operator: "=",
        value: entry.name,
      },
    ];
    const response = await page.request.post(`/api/${created.id}/insights`, {
      data: { ...definition, name: entry.name },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    const saved = insight.parse(await response.json());
    ids.push(saved.id);
    await page.goto(`/app/${created.id}/insights/${saved.id}`);
    const verify = async () => {
      if (entry.name === "Empty") {
        await expect(
          page.getByRole("img", { name: /Value chart preview/ }),
        ).toBeVisible();
        await expect(
          page.getByLabel("Current value", { exact: true }),
        ).toHaveCount(0);
        return;
      }
      await expect(
        page.getByLabel("Current value", { exact: true }),
      ).toHaveText(String(entry.current));
      await expect(
        page.getByLabel("Period change", { exact: true }),
      ).toContainText(entry.change);
      const comparison = page.getByRole("group", { name: "Period comparison" });
      await expect(
        comparison.getByText("Previous period", { exact: true }).locator(".."),
      ).toHaveText(`Previous period${entry.previous}`);
      const widths = await comparison
        .locator("[data-comparison-bar]")
        .evaluateAll((bars) =>
          bars.map((bar) => bar.getBoundingClientRect().width),
        );
      const currentWidth = widths[0];
      const previousWidth = widths[1];
      if (currentWidth === undefined || previousWidth === undefined)
        throw new Error("Missing comparison bars");
      if (entry.previous > 0)
        expect(currentWidth / previousWidth).toBeCloseTo(
          entry.current / entry.previous,
          2,
        );
      else expect(previousWidth).toBe(0);
      if (entry.current === 0) expect(currentWidth).toBe(0);
      else expect(currentWidth).toBeGreaterThan(0);
    };
    await verify();
    await page.reload();
    await verify();
    await page.setViewportSize({ width: 390, height: 844 });
    await verify();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    if (entry.name === "Increase")
      await page.screenshot({
        path: "output/value-bars-mobile.png",
        fullPage: true,
      });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  const dashboard = z.object({ id: z.number() }).parse(
    await (
      await page.request.post(`/api/${created.id}/dashboards`, {
        data: { name: "Value bars", favorite: false },
      })
    ).json(),
  );
  expect(
    (
      await page.request.put(
        `/api/${created.id}/dashboards/${dashboard.id}/insights`,
        { data: { insight_ids: ids } },
      )
    ).ok(),
  ).toBeTruthy();
  await page.goto(`/app/${created.id}/dashboards/${dashboard.id}`);
  await expect(
    page.getByRole("group", { name: "Period comparison" }),
  ).toHaveCount(cases.length - 1);
  await expect(
    page.getByRole("img", { name: /Value chart preview/ }),
  ).toBeVisible();
  for (const entry of cases.filter((entry) => entry.name !== "Empty"))
    await expect(
      page
        .getByLabel("Period change", { exact: true })
        .filter({ hasText: entry.change }),
    ).toBeVisible();
  await page.screenshot({
    path: "output/value-bars-dashboard.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
