import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../support/auth";
import {
  project,
  insight,
  dashboard,
  defaultInsights,
} from "../../packages/contracts/src/index";

test("insight changes update cached dashboards, preserve membership order, and stay isolated", async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const created = project.parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Entity consistency" },
      })
    ).json(),
  );
  const other = project.parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Isolated entities" },
      })
    ).json(),
  );
  const api = `/api/${created.id}`;
  const otherBefore = dashboard
    .array()
    .parse(
      await (await page.request.get(`/api/${other.id}/dashboards`)).json(),
    );
  const originals = insight
    .array()
    .parse(await (await page.request.get(`${api}/insights`)).json());
  const first = originals[0],
    second = originals[1];
  if (!first?.name || !second) throw new Error("Missing template insights");
  const saved = dashboard.parse(
    await (
      await page.request.post(`${api}/dashboards`, {
        data: {
          name: "Shared charts",
          insights: [{ id: second.id }, { id: first.id }],
        },
      })
    ).json(),
  );
  expect(saved.insights.map((item) => item.id)).toEqual([second.id, first.id]);
  const read = async () =>
    dashboard.parse(
      await (await page.request.get(`${api}/dashboards/${saved.id}`)).json(),
    );
  // A failed command must not partially replace membership or rename the dashboard.
  const invalid = await page.request.put(`${api}/dashboards/${saved.id}`, {
    data: {
      ...saved,
      name: "Should roll back",
      insights: [{ id: first.id }, { id: 999999 }],
    },
  });
  expect(invalid.status()).toBe(400);
  expect(await read()).toEqual(saved);
  expect(
    (
      await page.request.put(`${api}/dashboards/${saved.id}/insights`, {
        data: { insight_ids: [first.id, first.id] },
      })
    ).status(),
  ).toBe(400);
  expect(await read()).toEqual(saved);
  expect(
    (
      await page.request.put(`${api}/insights/${first.id}`, {
        data: { ...defaultInsights.Value, config: {} },
      })
    ).status(),
  ).toBe(400);
  expect(
    insight.parse(
      await (await page.request.get(`${api}/insights/${first.id}`)).json(),
    ),
  ).toEqual(first);
  expect((await page.request.get(`${api}/insights/999999`)).status()).toBe(404);

  await page.goto(`/app/${created.id}/dashboards/${saved.id}`);
  await page
    .getByRole("button", { name: "Manage Insights", exact: true })
    .click();
  const modal = page.getByRole("dialog", { name: "Manage Dashboard Insights" });
  await expect(
    modal.getByRole("list", { name: "Selected charts" }).getByRole("listitem"),
  ).toHaveCount(2);
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "Insights", exact: true }).click();
  await page.getByRole("link", { name: first.name, exact: true }).click();
  await page
    .getByRole("button", { name: `Rename ${first.name}`, exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Insight name", exact: true })
    .fill("Renamed shared chart");
  await page
    .getByRole("textbox", { name: "Insight name", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Rename Renamed shared chart",
      exact: true,
    }),
  ).toBeEnabled();
  await page.goBack();
  const card = page.getByRole("listitem").filter({
    has: page.getByRole("link", {
      name: "Renamed shared chart",
      exact: true,
    }),
  });
  await expect(card).toBeVisible();
  // Back navigation preserves the mounted application's QueryClient.
  await page.goBack();
  await page
    .getByRole("button", { name: "Manage Insights", exact: true })
    .click();
  await expect(
    modal.getByRole("list", { name: "Selected charts" }),
  ).toContainText("Renamed shared chart");
  await expect(
    modal.getByRole("list", { name: "Selected charts" }),
  ).not.toContainText(first.name ?? "Missing original name");
  await modal.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("link", { name: "Insights", exact: true }).click();
  await card
    .getByRole("button", {
      name: "Actions for Renamed shared chart",
      exact: true,
    })
    .click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.goBack();
  await page
    .getByRole("button", { name: "Manage Insights", exact: true })
    .click();
  await expect(
    modal.getByRole("list", { name: "Selected charts" }).getByRole("listitem"),
  ).toHaveCount(1);
  expect((await read()).insights.map((item) => item.id)).toEqual([second.id]);
  await page.reload();
  expect((await read()).insights.map((item) => item.id)).toEqual([second.id]);
  expect(
    dashboard
      .array()
      .parse(
        await (await page.request.get(`/api/${other.id}/dashboards`)).json(),
      ),
  ).toEqual(otherBefore);
});
