import { expect, test } from "@playwright/test";
import { z } from "zod";
import { dashboard, project } from "../../packages/contracts/src/index";

test("dashboard chart picker searches, cancels drafts, and persists only selected charts", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing test origin");
  const setup = z
    .object({ adminRegistered: z.boolean() })
    .parse(await (await page.request.get("/api/setup")).json());
  const login = await page.request.post(
    `/api/auth/${setup.adminRegistered ? "sign-in" : "sign-up"}/email`,
    {
      headers: { Origin: baseURL },
      data: {
        email: "migration@example.com",
        password: "Migration-test-password-42",
        name: "Migration",
      },
    },
  );
  expect(login.ok(), await login.text()).toBeTruthy();
  const response = await page.request.post("/api/projects", {
    data: { name: "Chart picker" },
  });
  expect(response.ok()).toBeTruthy();
  const created = project.parse(await response.json());
  const base = `/api/${created.id}/dashboards`;
  const originals = dashboard
    .array()
    .parse(await (await page.request.get(base)).json());
  const home = originals[0];
  if (!home) throw new Error("Missing default dashboard");
  const emptyResponse = await page.request.post(base, {
    data: { name: "Selected charts", favorite: false },
  });
  const empty = dashboard.parse(await emptyResponse.json());
  await page.goto(`/app/${created.id}/dashboards/${empty.id}`);
  const manage = page.getByRole("button", {
    name: "Manage Insights",
    exact: true,
  });
  for (const width of [1920, 1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(manage).toBeVisible();
    const heading = await page
      .getByRole("heading", { name: /Selected charts/ })
      .boundingBox();
    const action = await manage.boundingBox();
    const timeframe = await page
      .getByRole("button", { name: "Adjust", exact: true })
      .boundingBox();
    if (!heading || !action || !timeframe)
      throw new Error("Missing dashboard header controls");
    expect(timeframe.y).toBeGreaterThanOrEqual(heading.y + heading.height);
    expect(timeframe.y).toBeGreaterThanOrEqual(action.y + action.height);
    if (width >= 1280) {
      expect(action.x).toBeGreaterThan(heading.x + heading.width);
      expect(Math.abs(action.y - heading.y)).toBeLessThan(10);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  const modal = page.getByRole("dialog", { name: "Manage Dashboard Insights" });
  const selected = modal.getByRole("list", { name: "Selected charts" });
  const openPicker = async () => {
    await modal.getByRole("combobox", { name: "Add a chart" }).click();
    return page.getByRole("combobox", { name: "Search charts", exact: true });
  };
  await manage.click();
  await expect(modal.getByText("No charts added yet")).toBeVisible();
  let search = await openPicker();
  await search.fill("no matching chart");
  await expect(
    page.getByText("No charts found.", { exact: true }),
  ).toBeVisible();
  await search.fill("total");
  await expect(page.getByRole("option")).toHaveCount(1);
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(selected.getByRole("listitem")).toHaveCount(1);
  await expect(
    selected.getByText("Total events", { exact: true }),
  ).toBeVisible();
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  await manage.click();
  await expect(modal.getByText("No charts added yet")).toBeVisible();
  search = await openPicker();
  await search.fill("events over time");
  await page
    .getByRole("option", { name: "Events over time", exact: true })
    .click();
  search = await openPicker();
  await expect(
    page.getByRole("option", { name: "Events over time", exact: true }),
  ).toHaveCount(0);
  await search.fill("total");
  await page.getByRole("option", { name: "Total events", exact: true }).click();
  await modal
    .getByRole("button", { name: "Remove Events over time", exact: true })
    .click();
  await expect(selected.getByRole("listitem")).toHaveCount(1);
  const saveUrl = `${base}/${empty.id}/insights`;
  await page.route(`**${saveUrl}`, async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Save failed" }),
      });
    } else await route.continue();
  });
  await modal.getByRole("button", { name: "Save Changes" }).click();
  await expect(modal.getByRole("alert")).toContainText(
    "Could not save changes",
  );
  await expect(selected.getByRole("listitem")).toHaveCount(1);
  await page.unroute(`**${saveUrl}`);
  await modal.getByRole("button", { name: "Save Changes" }).click();
  await expect(modal).toBeHidden();
  await page.reload();
  await manage.click();
  await expect(selected.getByRole("listitem")).toHaveCount(1);
  await expect(
    selected.getByText("Total events", { exact: true }),
  ).toBeVisible();
  const persisted = dashboard.parse(
    await (await page.request.get(`${base}/${empty.id}`)).json(),
  );
  expect(persisted.insights.map((item) => item.name)).toEqual(["Total events"]);
  expect(
    dashboard.parse(
      await (await page.request.get(`${base}/${home.id}`)).json(),
    ),
  ).toEqual(home);
  await modal
    .getByRole("button", { name: "Remove Total events", exact: true })
    .click();
  await modal.getByRole("button", { name: "Save Changes" }).click();
  await expect(modal).toBeHidden();
  await page.reload();
  await manage.click();
  await expect(modal.getByText("No charts added yet")).toBeVisible();
  expect(
    dashboard.parse(
      await (await page.request.get(`${base}/${empty.id}`)).json(),
    ).insights,
  ).toEqual([]);
});
