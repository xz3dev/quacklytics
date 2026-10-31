import { loginAsAdmin } from "../support/auth";
import { test, expect, type Locator } from "@playwright/test";
import { z } from "zod";
import {
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";

async function expectSideBySideBars(chart: Locator, count: number) {
  const bars = chart.locator(".ts-chart__bar-y :is(rect, path)");
  await expect
    .poll(async () =>
      bars.evaluateAll((elements, expectedCount) => {
        const bounds = elements
          .map((element) => element.getBoundingClientRect())
          .filter((rect) => rect.height > 0 && rect.width > 0)
          .sort((a, b) => a.x - b.x);
        return (
          bounds.length === expectedCount &&
          bounds.every((rect, index) => {
            const previous = bounds[index - 1];
            return !previous || previous.right <= rect.left;
          })
        );
      }, count),
    )
    .toBe(true);
}

test("all charts break down by properties, persist, and restore ungrouped results", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
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
  const events = ["desktop", "mobile", null].flatMap((device, index) =>
    ["signup", "purchase"].map((eventType, step) => ({
      id: crypto.randomUUID(),
      eventType,
      personId: `person-${index}`,
      sessionId: `session-${index}`,
      timestamp: new Date(Date.now() - (3 - step) * 86400000).toISOString(),
      properties: device === null ? {} : { device },
    })),
  );
  const ingested = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key },
    data: { requestId: crypto.randomUUID(), events },
  });
  expect(ingested.ok(), await ingested.text()).toBeTruthy();
  const ids: number[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Maps are already grouped by country and offer no further breakdown.
  for (const definition of Object.values(defaultInsights).filter(
    (definition) => definition.type !== "Map",
  )) {
    const configured = insight.parse({ ...definition, id: 1 });
    if (configured.type === "Trend") {
      const original = configured.config.trend.series?.[0];
      if (!original) throw new Error("Missing trend series");
      // Trends span their whole range; cover only the two event days so the
      // grouped bars stay wide enough to hover individually.
      const day = (offset: number) =>
        new Date(Date.now() - offset * 86400000).toISOString().slice(0, 10);
      configured.config.trend.duration = `${day(3)} - ${day(2)}`;
      configured.config.trend.series = [
        { ...original, name: "Events", visualisation: "bar" },
        {
          ...original,
          name: "Purchases",
          visualisation: "bar",
          query: {
            ...original.query,
            filters: [
              {
                field: { name: "event_type", type: "string" },
                operator: "=",
                value: "purchase",
              },
            ],
          },
        },
      ];
    }
    if (configured.type === "Funnel") {
      configured.config.funnel.steps = ["signup", "purchase"].map(
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
    }
    const response = await page.request.post(
      `/api/${createdProject.id}/insights`,
      { data: { ...configured, name: `Grouped ${definition.type}` } },
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const saved = insight.parse(await response.json());
    ids.push(saved.id);
    await page.goto(`/app/${createdProject.id}/insights/${saved.id}`);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const plot = page.locator("[data-chart-minimum]");
    await expect(plot).toHaveCount(1);
    if (definition.type === "Trend") await expectSideBySideBars(plot, 3);
    const plotHeight = () =>
      plot.evaluate((element) => element.getBoundingClientRect().height);
    const layoutBottom = () =>
      page
        .locator("[data-chart-layout]")
        .evaluate(
          (element) => element.getBoundingClientRect().bottom + window.scrollY,
        );
    await expect.poll(layoutBottom).toBeGreaterThan(970);
    await expect.poll(layoutBottom).toBeLessThanOrEqual(977);
    const initialHeight = await plotHeight();
    await page.setViewportSize({ width: 1440, height: 1400 });
    await expect.poll(plotHeight).toBeGreaterThan(initialHeight + 390);
    await expect.poll(layoutBottom).toBeLessThanOrEqual(1377);
    if (definition.type !== "Value") {
      const graphic = plot.getByRole("img", {
        name: `Grouped ${definition.type}`,
        exact: true,
      });
      await expect
        .poll(() =>
          graphic.evaluate((element) => element.getBoundingClientRect().height),
        )
        .toBeGreaterThan(initialHeight + 390);
    }
    await page.screenshot({
      path: `output/chart-space-${definition.type.toLowerCase()}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect.poll(plotHeight).toBeLessThan(initialHeight + 2);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
    await expect(plot).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page
      .getByRole("combobox")
      .filter({ hasText: "Select breakdown field" })
      .click();
    await page.getByPlaceholder("Search field...").fill("device");
    await page.getByRole("option").filter({ hasText: "device" }).click();
    const groups = page.getByTestId("breakdown-group");
    await expect(groups).toHaveCount(0);
    await expect(plot).toHaveCount(1);
    const chart = page.getByRole("img", {
      name: `Grouped ${definition.type}`,
      exact: true,
    });
    await expect(chart).toBeVisible();
    for (const label of ["desktop", "mobile", "(missing)"]) {
      if (definition.type === "Trend") {
        await expect(
          page
            .getByTestId("chart-series")
            .filter({ hasText: `Events · ${label}` }),
        ).toBeVisible();
        await expect(
          page
            .getByTestId("chart-series")
            .filter({ hasText: `Purchases · ${label}` }),
        ).toBeVisible();
      } else if (definition.type === "Path") {
        await expect(
          page.getByTestId("chart-series").getByText(label, { exact: true }),
        ).toBeVisible();
        await expect(page.getByText("purchase", { exact: true })).toHaveCount(
          3,
        );
      } else {
        const row = page.getByRole("row").filter({ hasText: label });
        if (definition.type === "Value") {
          await expect(row.getByRole("cell").nth(1)).toHaveText("2");
          await expect(row.getByRole("cell").nth(2)).toHaveText("0");
        } else if (definition.type === "Funnel") {
          await expect(
            page
              .getByRole("rowgroup", { name: label, exact: true })
              .getByRole("row")
              .filter({ hasText: "purchase" })
              .getByRole("cell")
              .nth(1),
          ).toHaveText("1");
          await expect(
            page
              .getByRole("rowgroup", { name: label, exact: true })
              .getByRole("row")
              .filter({ hasText: "purchase" }),
          ).toContainText("100.0%");
        } else if (definition.type === "Breakdown") {
          await expect(
            row.filter({ hasText: "signup" }).getByRole("cell").nth(1),
          ).toHaveText("1");
        } else {
          await expect(page.getByRole("table")).toHaveCount(0);
          await expect(
            chart.getByText(
              new RegExp(` · ${label.replace(/[()]/g, "\\$&")}$`),
            ),
          ).toBeVisible();
          const cohortIndex = ["desktop", "mobile", "(missing)"].indexOf(label);
          await chart
            .locator(".ts-chart__rect rect")
            .nth(cohortIndex * 15)
            .hover({ position: { x: 4, y: 4 } });
          await expect(
            page.getByRole("status").and(page.locator(".analytics-tooltip")),
          ).toHaveAccessibleName(/Retention: 100%/);
          await expect(
            page.getByRole("status").and(page.locator(".analytics-tooltip")),
          ).toHaveAccessibleName(/Users: 1 user/);
        }
      }
    }
    if (definition.type === "Trend") {
      await expect(page.getByTestId("chart-series")).toHaveCount(6);
      await expectSideBySideBars(chart, 9);
      const bars = chart.locator(".ts-chart__bar-y :is(rect, path)");
      for (const [index, label] of [
        "desktop",
        "mobile",
        "(missing)",
      ].entries()) {
        await bars.nth(index * 2).hover({ position: { x: 4, y: 4 } });
        await expect(
          page.getByRole("status").and(page.locator(".analytics-tooltip")),
        ).toContainText(`Events · ${label}`);
        await expect(page.locator(".ts-chart-tooltip__row")).toContainText(
          "1 event",
        );
        await expect(page.locator(".ts-chart-tooltip__row")).toHaveCount(1);
      }
    }
    if (definition.type === "Trend") {
      await page.setViewportSize({ width: 320, height: 844 });
      const bars = chart.locator(".ts-chart__bar-y :is(rect, path)");
      await expect
        .poll(async () => {
          const first = await bars.nth(0).boundingBox();
          const second = await bars.nth(2).boundingBox();
          if (!first || !second) return Infinity;
          return Math.abs(
            second.x + second.width / 2 - first.x - first.width / 2,
          );
        })
        .toBeLessThanOrEqual(12);
      await bars.first().hover();
      await expect(page.locator(".ts-chart-tooltip__row")).toHaveCount(2);
      await expect(
        page.getByRole("status").and(page.locator(".analytics-tooltip")),
      ).toContainText("Events · desktop");
      await expect(
        page.getByRole("status").and(page.locator(".analytics-tooltip")),
      ).toContainText("Events · mobile");
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    if (["Value", "Funnel", "Path"].includes(definition.type)) {
      const bars = chart.locator(".ts-chart__bar-y :is(rect, path)");
      for (const [index, label] of [
        "desktop",
        "mobile",
        "(missing)",
      ].entries()) {
        const bar = bars.nth(definition.type === "Path" ? index : index * 2);
        await bar.hover({ position: { x: 4, y: 4 } });
        await expect(
          page.getByRole("status").and(page.locator(".analytics-tooltip")),
        ).toContainText(label);
        await expect(
          page.locator(".ts-chart-tooltip__row").first(),
        ).toContainText(
          definition.type === "Value"
            ? "2 events"
            : definition.type === "Funnel"
              ? "1 user"
              : "1 transition",
        );
        await expect(page.locator(".ts-chart-tooltip__row")).toHaveCount(
          definition.type === "Funnel" ? 6 : 1,
        );
      }
    }
    await page.screenshot({
      path: `output/insight-sidebar-data-${definition.type.toLowerCase()}.png`,
      fullPage: true,
    });
    await expect(page.getByText(/Error:/)).toHaveCount(0);
    const save = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/insights/${saved.id}`) &&
        r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const persisted = insight.parse(await (await save).json());
    expect(persisted.breakdownBy?.name).toContain("device");
    await expect(page).toHaveURL(
      `/app/${createdProject.id}/insights/${saved.id}`,
    );
    await page.reload();
    await expect(chart).toBeVisible();
    await expect(plot).toHaveCount(1);
    if (definition.type === "Trend") {
      await expectSideBySideBars(chart, 9);
    }
    if (persisted.type === "Trend") {
      const lineInsight = insight.parse(persisted);
      if (lineInsight.type !== "Trend") throw new Error("Expected trend");
      for (const series of lineInsight.config.trend.series ?? []) {
        series.visualisation = "line";
      }
      const update = await page.request.put(
        `/api/${createdProject.id}/insights/${saved.id}`,
        { data: lineInsight },
      );
      expect(update.ok(), await update.text()).toBeTruthy();
      await page.reload();
      const line = chart.locator(".ts-chart__line path").first();
      await expect(line).toHaveAttribute("d", /^M/);
      const start = await line.evaluate((element) => {
        if (!(element instanceof SVGPathElement))
          throw new Error("Expected line path");
        const point = element.getPointAtLength(0);
        const matrix = element.getScreenCTM();
        if (!matrix) throw new Error("Missing chart transform");
        return new DOMPoint(point.x, point.y).matrixTransform(matrix).toJSON();
      });
      const position = z.object({ x: z.number(), y: z.number() }).parse(start);
      await page.mouse.move(position.x, position.y);
      await expect(page.locator(".ts-chart-tooltip__row")).toHaveCount(3);
      for (const label of ["desktop", "mobile", "(missing)"]) {
        await expect(
          page.getByRole("status").and(page.locator(".analytics-tooltip")),
        ).toContainText(`Events · ${label}`);
      }
    }
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByRole("button", { name: "Remove breakdown" }).click();
    await expect(groups).toHaveCount(0);
    if (definition.type === "Value")
      await expect(
        page
          .getByText("Current period", { exact: true })
          .locator("..")
          .getByText("6", { exact: true }),
      ).toBeVisible();
    await page
      .getByRole("button", { name: "Discard Changes", exact: true })
      .click();
    await expect(chart).toBeVisible();
    await expect(plot).toHaveCount(1);
  }
  const dashboardResponse = await page.request.post(
    `/api/${createdProject.id}/dashboards`,
    { data: { name: "Grouped dashboard", favorite: false } },
  );
  const dashboard = z
    .object({ id: z.number() })
    .parse(await dashboardResponse.json());
  expect(
    (
      await page.request.put(
        `/api/${createdProject.id}/dashboards/${dashboard.id}/insights`,
        { data: { insight_ids: ids } },
      )
    ).ok(),
  ).toBeTruthy();
  await page.goto(`/app/${createdProject.id}/dashboards/${dashboard.id}`);
  await expect(page.getByTestId("breakdown-group")).toHaveCount(0);
  await expect(page.locator("[data-chart-minimum]")).toHaveCount(6);
  await expect(page.getByTestId("chart-series")).toHaveCount(15);
  await expect(page.getByText(/Error:/)).toHaveCount(0);
  expect(errors).toEqual([]);
});
