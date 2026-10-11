import { loginAsAdmin } from "../support/auth";
import { expect, test, type Locator } from "@playwright/test";
import {
  DASHBOARD_GRID,
  dashboard,
  project,
} from "../../packages/contracts/src/index";

test("dashboard layout gates movement, snaps resizing, saves drafts and isolates layouts", async ({
  page,
  baseURL,
}, testInfo) => {
  if (!baseURL) throw new Error("Missing origin");
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const created = project.parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Layout grid" },
      })
    ).json(),
  );
  const api = `/api/${created.id}/dashboards`;
  const originals = dashboard
    .array()
    .parse(await (await page.request.get(api)).json());
  const home = originals[0];
  if (!home) throw new Error("Missing home dashboard");
  const target = dashboard.parse(
    await (
      await page.request.post(`${api}/templates/product_analytics`, {
        data: { name: "Editable grid" },
      })
    ).json(),
  );
  const [first, second, third] = target.insights;
  if (!first || !second || !third) throw new Error("Missing template insights");
  const url = `${api}/${target.id}`;
  const read = async () =>
    dashboard.parse(await (await page.request.get(url)).json());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/app/${created.id}/dashboards/${target.id}`);
  const grid = page.getByRole("region", { name: "Dashboard layout" });
  const card = (id: number) => page.getByTestId(`dashboard-insight-${id}`);
  const drag = async (handle: Locator, dx: number, dy: number) => {
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    if (!box) throw new Error("Missing handle");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + dx,
      box.y + box.height / 2 + dy,
      { steps: 8 },
    );
    await page.mouse.up();
  };
  await expect(grid).toHaveAttribute("data-editing", "false");
  await expect(grid.getByRole("button", { name: /^Move / })).toHaveCount(0);
  await expect(grid.getByRole("button", { name: /^Resize / })).toHaveCount(0);
  await drag(card(first.id), 100, 72);
  await expect(card(first.id)).toHaveAttribute("data-grid-x", "0");
  await expect(card(first.id)).toHaveAttribute("data-grid-y", "0");
  expect((await read()).layout).toBeUndefined();
  await page
    .getByRole("button", { name: "Adjust layout", exact: true })
    .click();
  const bounds = await grid.boundingBox();
  if (!bounds) throw new Error("Missing grid");
  const column = (bounds.width + DASHBOARD_GRID.gap) / DASHBOARD_GRID.columns;
  const row = DASHBOARD_GRID.rowHeight + DASHBOARD_GRID.gap;
  await drag(
    grid.getByRole("button", {
      name: `Resize ${first.name} left border`,
      exact: true,
    }),
    column,
    0,
  );
  await expect(card(first.id)).toHaveAttribute("data-grid-width", "5");
  await expect(card(first.id)).toHaveAttribute("data-grid-x", "1");
  await drag(
    grid.getByRole("button", {
      name: `Resize ${second.name} right border`,
      exact: true,
    }),
    -column,
    0,
  );
  await expect(card(second.id)).toHaveAttribute("data-grid-width", "5");
  await expect(card(second.id)).toHaveAttribute("data-grid-x", "6");
  // The dragged border moves back out, while its opposite edge stays fixed.
  await drag(
    grid.getByRole("button", {
      name: `Resize ${second.name} right border`,
      exact: true,
    }),
    column,
    0,
  );
  await expect(card(second.id)).toHaveAttribute("data-grid-width", "6");
  await expect(card(second.id)).toHaveAttribute("data-grid-x", "6");
  await drag(
    grid.getByRole("button", {
      name: `Resize ${second.name} right border`,
      exact: true,
    }),
    column,
    0,
  );
  await expect(card(second.id)).toHaveAttribute("data-grid-width", "6");
  await expect(card(second.id)).toHaveAttribute("data-grid-x", "6");
  // Top-edge resizing follows the pointer too, preserving the bottom edge.
  await drag(
    grid.getByRole("button", {
      name: `Resize ${second.name} top border`,
      exact: true,
    }),
    0,
    row,
  );
  await expect(card(second.id)).toHaveAttribute("data-grid-y", "1");
  await expect(card(second.id)).toHaveAttribute("data-grid-height", "5");
  await drag(
    grid.getByRole("button", {
      name: `Resize ${second.name} top border`,
      exact: true,
    }),
    0,
    -row * 2,
  );
  await expect(card(second.id)).toHaveAttribute("data-grid-y", "0");
  await expect(card(second.id)).toHaveAttribute("data-grid-height", "6");
  const plot = card(first.id).locator("[data-chart-minimum]");
  await expect(plot).toBeVisible();
  const beforeHeight = await plot.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  await drag(
    grid.getByRole("button", {
      name: `Resize ${first.name} bottom border`,
      exact: true,
    }),
    0,
    row,
  );
  await expect(card(first.id)).toHaveAttribute("data-grid-height", "7");
  await expect(card(third.id)).toHaveAttribute("data-grid-y", "7");
  await expect
    .poll(() =>
      plot.evaluate((element) => element.getBoundingClientRect().height),
    )
    .toBeGreaterThan(beforeHeight + row - 2);
  await expect
    .poll(() =>
      card(second.id)
        .locator("[data-dashboard-card]")
        .evaluate((element) => element.scrollHeight - element.clientHeight),
    )
    .toBeLessThanOrEqual(1);

  // Dragging the chart body moves the card, not just a small header handle.
  await drag(plot, -column, 0);
  await expect(card(first.id)).toHaveAttribute("data-grid-x", "0");
  // The title is also covered by the drag surface and cannot navigate in adjust mode.
  const title = card(first.id).locator(`a[href$="/insights/${first.id}"]`);
  await drag(title, column, 0);
  await expect(card(first.id)).toHaveAttribute("data-grid-x", "1");
  await expect(page).toHaveURL(`/app/${created.id}/dashboards/${target.id}`);
  expect((await read()).layout).toBeUndefined();
  await page.screenshot({
    path: testInfo.outputPath("adjust-layout.png"),
    fullPage: true,
  });
  await page.route(`**${url}/layout`, (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Save failed" }),
    }),
  );
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not save layout");
  await expect(card(first.id)).toHaveAttribute("data-grid-width", "5");
  expect((await read()).layout).toBeUndefined();
  await page.unroute(`**${url}/layout`);
  await page.getByRole("button", { name: "Save layout", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Adjust layout", exact: true }),
  ).toBeVisible();
  const saved = await read();
  expect(saved.layout?.find((item) => item.insightId === first.id)).toEqual({
    insightId: first.id,
    x: 1,
    y: 0,
    w: 5,
    h: 7,
  });
  await page.reload();
  await expect(card(first.id)).toHaveAttribute("data-grid-width", "5");
  await expect(card(first.id)).toHaveAttribute("data-grid-height", "7");
  await expect(grid.getByRole("button", { name: /^Move / })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Adjust layout", exact: true })
    .click();
  await grid
    .getByRole("button", { name: `Move ${first.name}`, exact: true })
    .press("ArrowDown");
  await expect(card(first.id)).toHaveAttribute("data-grid-y", "0");
  await drag(
    grid.getByRole("button", { name: `Move ${first.name}`, exact: true }),
    0,
    row,
  );
  await expect(card(first.id)).toHaveAttribute("data-grid-y", "1");
  // Minimum dimensions and dashboard boundaries also hold for large drags.
  await drag(
    grid.getByRole("button", {
      name: `Resize ${first.name} right border`,
      exact: true,
    }),
    -column * 10,
    0,
  );
  await expect(card(first.id)).toHaveAttribute(
    "data-grid-width",
    String(DASHBOARD_GRID.minWidth),
  );
  await drag(
    grid.getByRole("button", {
      name: `Resize ${first.name} bottom border`,
      exact: true,
    }),
    0,
    -row * 10,
  );
  await expect(card(first.id)).toHaveAttribute(
    "data-grid-height",
    String(DASHBOARD_GRID.minHeight),
  );
  await drag(
    grid.getByRole("button", { name: `Move ${first.name}`, exact: true }),
    -column * 10,
    -row * 10,
  );
  await expect(card(first.id)).toHaveAttribute("data-grid-x", "0");
  await expect(card(first.id)).toHaveAttribute("data-grid-y", "0");
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(card(first.id)).toHaveAttribute("data-grid-y", "0");
  expect((await read()).layout).toEqual(saved.layout);
  // Normal insight navigation is restored when adjustment ends.
  await card(first.id)
    .getByRole("link", { name: first.name ?? "", exact: true })
    .click();
  await expect(page).toHaveURL(`/app/${created.id}/insights/${first.id}`);
  await page.goBack();
  await expect(grid).toHaveAttribute("data-editing", "false");
  // Invalid bounds, overlaps, duplicates and foreign insight IDs cannot replace the saved layout.
  for (const layout of [
    [{ insightId: first.id, x: 11, y: 0, w: 6, h: 6 }],
    target.insights.map((item) => ({
      insightId: item.id,
      x: 0,
      y: 0,
      w: 6,
      h: 6,
    })),
    [
      { insightId: first.id, x: 0, y: 0, w: 6, h: 6 },
      { insightId: first.id, x: 6, y: 0, w: 6, h: 6 },
    ],
    [{ insightId: 999999, x: 0, y: 0, w: 6, h: 6 }],
  ]) {
    expect(
      (await page.request.put(`${url}/layout`, { data: { layout } })).ok(),
    ).toBe(false);
    expect((await read()).layout).toEqual(saved.layout);
  }
  expect(
    dashboard.parse(await (await page.request.get(`${api}/${home.id}`)).json()),
  ).toEqual(home);
  // Removing a chart preserves remaining placements; re-adding it gets a free slot.
  await page.request.put(`${url}/insights`, {
    data: {
      insight_ids: target.insights
        .filter((item) => item.id !== third.id)
        .map((item) => item.id),
    },
  });
  expect((await read()).layout).toEqual(
    saved.layout?.filter((item) => item.insightId !== third.id),
  );
  await page.request.put(`${url}/insights`, {
    data: { insight_ids: target.insights.map((item) => item.id) },
  });
  await page.reload();
  await expect(card(third.id)).toBeVisible();
  await expect(card(first.id)).toHaveAttribute("data-grid-x", "1");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const a = await card(first.id).boundingBox();
      const b = await card(second.id).boundingBox();
      return !!a && !!b && Math.abs(a.x - b.x) < 1 && b.y >= a.y + a.height;
    })
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("layout-mobile.png"),
    fullPage: true,
  });
  expect((await read()).layout).toEqual(
    saved.layout?.filter((item) => item.insightId !== third.id),
  );
  await page.goto(`/app/${created.id}`);
  await expect(
    page.getByRole("region", { name: "Dashboard layout" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Adjust layout", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Move / })).toHaveCount(0);
});
