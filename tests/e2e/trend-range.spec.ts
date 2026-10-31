import { loginAsAdmin } from "../support/auth";
import { expect, test, type Locator } from "@playwright/test";
import { z } from "zod";
import {
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";

const day = 86400000;

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

async function linePoint(line: Locator, at: "start" | "end") {
  return z
    .object({ x: z.number(), y: z.number() })
    .parse(
      await line.evaluate((element, at) => {
        if (!(element instanceof SVGPathElement))
          throw new Error("Expected line path");
        const point = element.getPointAtLength(
          at === "start" ? 0 : element.getTotalLength(),
        );
        const matrix = element.getScreenCTM();
        if (!matrix) throw new Error("Missing chart transform");
        return new DOMPoint(point.x, point.y).matrixTransform(matrix).toJSON();
      }, at),
    );
}

test("trend charts span the whole selected range when only a few days have data", async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const created = project.parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Sparse trend" },
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
  // Only two of the last 30 complete days hold events.
  const events = [3, 3, 2].map((daysAgo) => ({
    id: crypto.randomUUID(),
    eventType: "signup",
    personId: "person",
    sessionId: "session",
    timestamp: new Date(Date.now() - daysAgo * day).toISOString(),
    properties: {},
  }));
  const ingested = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key },
    data: { requestId: crypto.randomUUID(), events },
  });
  expect(ingested.ok(), await ingested.text()).toBeTruthy();
  const response = await page.request.post(`/api/${created.id}/insights`, {
    data: { ...defaultInsights.Trend, name: "Sparse trend" },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const saved = insight.parse(await response.json());
  if (saved.type !== "Trend") throw new Error("Expected trend");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/app/${created.id}/insights/${saved.id}`);
  const chart = page.getByRole("img", { name: "Sparse trend", exact: true });
  const tooltip = page.locator(".analytics-tooltip:visible");
  const line = chart.locator(".ts-chart__line path");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveAttribute("d", /^M/);

  // The line starts on the first day of the range at zero, not at the first
  // day with data, and runs through the last complete day.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (const [at, date] of [
    ["start", new Date(today.getTime() - 30 * day)],
    ["end", new Date(today.getTime() - day)],
  ] as const) {
    const point = await linePoint(line, at);
    await page.mouse.move(point.x, point.y);
    await expect(tooltip.locator(".ts-chart-tooltip__title")).toHaveText(
      formatDay(date),
    );
    await expect(tooltip.locator(".ts-chart-tooltip__row")).toContainText(
      "0 events",
    );
    await page.mouse.move(0, 0);
  }
  const plot = await chart.boundingBox();
  if (!plot) throw new Error("Missing chart bounds");
  const start = await linePoint(line, "start");
  const end = await linePoint(line, "end");
  expect(end.x - start.x).toBeGreaterThan(plot.width * 0.8);

  // Bars leave empty days blank but keep their slots across the range, so the
  // two days with data sit at the right edge of the chart.
  for (const series of saved.config.trend.series ?? [])
    series.visualisation = "bar";
  const update = await page.request.put(
    `/api/${created.id}/insights/${saved.id}`,
    { data: saved },
  );
  expect(update.ok(), await update.text()).toBeTruthy();
  await page.reload();
  const bars = chart.locator(".ts-chart__bar-y :is(rect, path)");
  await expect(bars).toHaveCount(2);
  for (const bar of await bars.all()) {
    const bounds = await bar.boundingBox();
    if (!bounds) throw new Error("Missing bar bounds");
    expect(bounds.x).toBeGreaterThan(plot.x + plot.width * 0.85);
    expect(bounds.width).toBeLessThan(plot.width / 20);
  }
  await bars.first().hover();
  await expect(tooltip.locator(".ts-chart-tooltip__row")).toContainText(
    "2 events",
  );
});
