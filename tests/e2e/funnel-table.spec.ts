import { loginAsAdmin } from "../support/auth";
import { test, expect } from "@playwright/test";
import { z } from "zod";
import {
  dashboard,
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";

test("funnel table groups long values and preserves metrics on narrow screens", async ({
  page,
  baseURL,
}) => {
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

  const agent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  const events = [0, 1, 2].flatMap((person) =>
    (person === 2
      ? ["Viewed pricing"]
      : ["Viewed pricing", "Started trial"]
    ).map((eventType, step) => ({
      id: crypto.randomUUID(),
      eventType,
      personId: `person-${person}`,
      sessionId: `session-${person}`,
      timestamp: new Date(Date.now() - (3 - step) * 86400000).toISOString(),
      properties: { agent },
    })),
  );
  const ingested = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key },
    data: { requestId: crypto.randomUUID(), events },
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
  const response = await page.request.post(
    `/api/${createdProject.id}/insights`,
    {
      data: {
        ...configured,
        name: "Trial funnel",
        breakdownBy: { name: "agent", type: "string", isProperty: true },
      },
    },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  const saved = insight.parse(await response.json());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/app/${createdProject.id}/insights/${saved.id}`);
  const bars = page
    .getByRole("img", { name: "Trial funnel", exact: true })
    .locator(".ts-chart__bar-y :is(rect, path):not([fill^='url('])");
  const expectFilledBars = async () => {
    await expect(bars).toHaveCount(2);
    await expect
      .poll(() =>
        bars.evaluateAll((elements) => {
          const [first, second] = elements.map((element) =>
            element.getBoundingClientRect(),
          );
          if (!first || !second) return false;
          const spacing = second.x - first.x;
          return (
            first.width > spacing * 0.7 &&
            first.width < spacing &&
            Math.abs(first.width - second.width) < 1 &&
            first.height > second.height &&
            Math.abs(second.height / first.height - 2 / 3) < 0.02
          );
        }),
      )
      .toBe(true);
  };
  const table = page.getByRole("table", { name: "Funnel results" });
  const group = table.getByRole("rowgroup", { name: agent, exact: true });
  const trial = group.getByRole("row").filter({ hasText: "Started trial" });
  await expect(trial.getByRole("cell")).toHaveText([
    "2Started trial",
    "2",
    "66.7%",
    "133.3% of previous",
    "66.7%",
    "1d",
  ]);
  await expectFilledBars();
  const droppedBar = page
    .getByRole("img", { name: "Trial funnel", exact: true })
    .locator(".ts-chart__bar-y :is(rect, path)[fill^='url(']");
  await expect(droppedBar).toHaveCount(1);
  await expect
    .poll(async () => {
      const first = await bars.first().boundingBox();
      const second = await bars.nth(1).boundingBox();
      const dropped = await droppedBar.boundingBox();
      return (
        !!first &&
        !!second &&
        !!dropped &&
        Math.abs(first.y - dropped.y) < 1 &&
        Math.abs(dropped.y + dropped.height - second.y) < 1 &&
        Math.abs(second.width - dropped.width) < 1
      );
    })
    .toBe(true);
  await droppedBar.hover();
  const tooltip = page.locator(".analytics-tooltip");
  const expectTooltipInViewport = async () => {
    await expect(tooltip).toBeVisible();
    await expect
      .poll(() =>
        tooltip.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return (
            bounds.left >= 0 &&
            bounds.top >= 0 &&
            bounds.right <= window.innerWidth &&
            bounds.bottom <= window.innerHeight &&
            element.scrollWidth <= element.clientWidth
          );
        }),
      )
      .toBe(true);
  };
  await expect(tooltip).toContainText("Step 2: Started trial");
  await expect(tooltip).toContainText(
    "Dropped off from previous1 user · 33.3%",
  );
  await expect(tooltip).toContainText("Dropped off from start1 user · 33.3%");
  await expect(tooltip).toContainText("Avg. time from previous1d");
  const label = group.getByRole("button", { name: agent, exact: true });
  await expect(label).toHaveAttribute("aria-expanded", "false");
  await expect(trial).not.toContainText(agent);
  await page.setViewportSize({ width: 800, height: 1000 });
  const collapsedHeight = await label.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  await label.click();
  await expect(label).toHaveAttribute("aria-expanded", "true");
  await expect(group.getByText(agent, { exact: true })).toHaveCount(1);
  await expect
    .poll(() =>
      label.evaluate((element) => element.getBoundingClientRect().height),
    )
    .toBeGreaterThan(collapsedHeight);
  await expect
    .poll(() =>
      label.evaluate((element) => element.scrollWidth <= element.clientWidth),
    )
    .toBe(true);
  await label.press("Enter");
  await expect(label).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "output/funnel-table-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expectFilledBars();
  await droppedBar.hover();
  await expectTooltipInViewport();
  await expect(tooltip).toContainText("Avg. time from previous1d");
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  await trial.scrollIntoViewIfNeeded();
  await table.locator("..").evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(trial.getByRole("cell").last()).toBeInViewport();
  await page.screenshot({
    path: "output/funnel-table-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(trial.getByRole("cell").nth(2)).toHaveText("66.7%");

  // A short dashboard tile keeps its painted card surface fixed while its
  // funnel contents scroll, including the final metrics and explanatory text.
  const dashboardsApi = `/api/${createdProject.id}/dashboards`;
  const createdDashboard = dashboard.parse(
    await (
      await page.request.post(dashboardsApi, {
        data: { name: "Scrollable funnel", favorite: false },
      })
    ).json(),
  );
  const dashboardApi = `${dashboardsApi}/${createdDashboard.id}`;
  expect(
    (
      await page.request.put(`${dashboardApi}/insights`, {
        data: { insight_ids: [saved.id] },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.put(`${dashboardApi}/layout`, {
        data: { layout: [{ insightId: saved.id, x: 0, y: 0, w: 6, h: 4 }] },
      })
    ).ok(),
  ).toBeTruthy();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/app/${createdProject.id}/dashboards/${createdDashboard.id}`,
  );
  await expect(trial.getByRole("cell").nth(2)).toHaveText("66.7%");
  const viewport = page
    .getByTestId(`dashboard-insight-${saved.id}`)
    .locator("[data-dashboard-card]");
  const surface = viewport.locator(":scope > div");
  await expect
    .poll(() =>
      surface.evaluate(
        (element) => element.scrollHeight - element.clientHeight,
      ),
    )
    .toBeGreaterThan(100);
  const before = await surface.boundingBox();
  if (!before) throw new Error("Missing card surface");
  // The tooltip escapes the card's scrolling/clipping surface into the top layer.
  await droppedBar.hover();
  await expectTooltipInViewport();
  await expect(tooltip).toContainText("Step 2: Started trial");
  await expect
    .poll(() => tooltip.evaluate((element) => element.matches(":popover-open")))
    .toBe(true);
  await expect
    .poll(async () => {
      const bounds = await tooltip.boundingBox();
      return !!bounds && bounds.x + bounds.width > before.x + before.width;
    })
    .toBe(true);
  await page.screenshot({ path: "output/funnel-tooltip-portal.png" });
  await page.mouse.move(0, 0);
  await expect(tooltip).toBeHidden();
  const chartHeight = await page
    .locator("[data-chart-minimum]")
    .evaluate((element) => element.getBoundingClientRect().height);
  await surface.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => surface.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(100);
  expect(await surface.boundingBox()).toEqual(before);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(
    viewport.getByText(/Conversion is shown from the start/),
  ).toBeInViewport();
  await expect(trial.getByRole("cell").nth(2)).toHaveText("66.7%");
  // Expanding a group while scrolled must not resize the plot based on scroll offset.
  await label.click();
  await expect(label).toHaveAttribute("aria-expanded", "true");
  await expect
    .poll(() =>
      page
        .locator("[data-chart-minimum]")
        .evaluate((element) => element.getBoundingClientRect().height),
    )
    .toBe(chartHeight);
});
