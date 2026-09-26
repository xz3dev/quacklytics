import { expect, test } from "@playwright/test";
import { z } from "zod";
import {
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";

test("favorite cards support persistent actions, errors, navigation and responsive layout", async ({
  page,
  baseURL,
}, testInfo) => {
  if (!baseURL) throw new Error("Missing origin");
  const setup = z
    .object({ adminRegistered: z.boolean() })
    .parse(await (await page.request.get("/api/setup")).json());
  const auth = await page.request.post(
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
  expect(auth.ok()).toBeTruthy();
  const created = project.parse(
    await (
      await page.request.post("/api/projects", { data: { name: "Cards" } })
    ).json(),
  );
  const other = project.parse(
    await (
      await page.request.post("/api/projects", { data: { name: "Isolated" } })
    ).json(),
  );
  const otherUrl = `/api/${other.id}/insights`;
  const isolated = await (await page.request.get(otherUrl)).json();
  const api = `/api/${created.id}/insights`;
  const names = [
    "Daily workspace visits and completed tasks",
    "Revenue this month (EUR)",
    "Pricing to paid subscription",
    "Feature adoption",
    "Workspace retention by signup cohort",
    "Journeys from the home page",
  ] as const;
  const types = [
    "Trend",
    "Value",
    "Funnel",
    "Breakdown",
    "Retention",
    "Path",
  ] as const;
  for (const [index, type] of types.entries()) {
    const response = await page.request.post(api, {
      data: { ...defaultInsights[type], name: names[index], favorite: true },
    });
    expect(response.ok()).toBeTruthy();
  }
  await page.addInitScript(() => localStorage.setItem("ui-theme", "light"));
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto(`/app/${created.id}`);
  const favorites = page.getByRole("region", { name: "Favorite Insights" });
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await expect(sidebar).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "Home", exact: true }),
  ).toBeVisible();
  await sidebar.getByRole("link", { name: "Insights", exact: true }).click();
  await expect(page).toHaveURL(`/app/${created.id}/insights`);
  await sidebar.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(`/app/${created.id}`);
  await expect(favorites.getByRole("listitem")).toHaveCount(6);
  await expect(
    page.getByRole("link", { name: "View all favorite insights", exact: true }),
  ).toHaveCount(0);
  const trendCard = favorites.getByRole("listitem").filter({
    has: page.getByRole("link", {
      name: "Daily workspace visits and completed tasks",
      exact: true,
    }),
  });
  await expect(
    trendCard.getByRole("link", { name: names[0], exact: true }),
  ).toBeVisible();
  await expect(trendCard.getByText("Trend", { exact: true })).toBeVisible();
  await expect(favorites.getByText("Value", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    trendCard.getByRole("link", { name: names[0], exact: true }),
  ).toBeVisible();
  const originalNames = insight
    .array()
    .parse(await (await page.request.get(api)).json());
  expect(originalNames.some((item) => item.name === names[0])).toBe(true);
  await expect(
    page.getByRole("link", { name: "Events over time", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Adjust", exact: true }).click();
  await page.getByRole("combobox", { name: "Time grouping" }).click();
  await page.getByRole("option", { name: "Day", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reset overrides" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset overrides" }).click();
  await expect(
    page.getByRole("button", { name: "Reset overrides" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("cards-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create New Insight", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(favorites.getByRole("listitem")).toHaveCount(6);
  const viewFavorites = page.getByRole("link", {
    name: "View all favorite insights",
    exact: true,
  });
  await expect(viewFavorites).toBeVisible();
  await viewFavorites.click();
  await expect(page).toHaveURL(/insights\?favorites=true$/);
  await expect(
    page.getByRole("heading", { name: "Favorite Insights", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Favorite Insights" })
      .getByRole("listitem"),
  ).toHaveCount(7);
  await expect(
    page.getByRole("link", { name: "Events over time", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Untitled trend", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Favorite Insights" })
      .getByRole("listitem"),
  ).toHaveCount(7);
  await page.goto(`/app/${created.id}`);
  await page
    .getByRole("button", {
      name: "Remove Journeys from the home page from favorites",
      exact: true,
    })
    .click();
  await expect(viewFavorites).toHaveCount(0);
  await expect(favorites.getByRole("listitem")).toHaveCount(6);
  await page
    .getByRole("button", {
      name: "Actions for Untitled trend",
      exact: true,
    })
    .click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  await favorites
    .getByRole("textbox", { name: "Insight name" })
    .fill("Renamed · card");
  await page.route(`**${api}/*`, async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed" }),
      });
    else await route.continue();
  });
  await favorites.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Could not save changes");
  await expect(
    favorites.getByRole("textbox", { name: "Insight name" }),
  ).toHaveValue("Renamed · card");
  await page.unroute(`**${api}/*`);
  await favorites.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    favorites.getByRole("link", { name: "Renamed · card", exact: true }),
  ).toBeVisible();
  await page.reload();
  await favorites
    .getByRole("link", { name: "Renamed · card", exact: true })
    .click();
  await expect(page).toHaveURL(/\/insights\/\d+$/);
  await page.goto(`/app/${created.id}`);
  await page
    .getByRole("button", {
      name: "Remove Renamed · card from favorites",
      exact: true,
    })
    .click();
  await expect(favorites.getByRole("listitem")).toHaveCount(5);
  await page.reload();
  await expect(
    favorites.getByRole("link", { name: "Renamed · card", exact: true }),
  ).toHaveCount(0);
  const saved = insight
    .array()
    .parse(await (await page.request.get(api)).json());
  expect(saved.find((item) => item.name === "Renamed · card")?.favorite).toBe(
    false,
  );
  await page
    .getByRole("button", { name: `Actions for ${names[0]}`, exact: true })
    .click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(favorites.getByRole("listitem")).toHaveCount(4);
  await page.reload();
  await expect(favorites.getByRole("listitem")).toHaveCount(4);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    favorites.getByRole("link", {
      name: "Revenue this month (EUR)",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("cards-mobile.png"),
    fullPage: true,
  });
  expect(await (await page.request.get(otherUrl)).json()).toEqual(isolated);
  await page.getByRole("link", { name: "View all insights" }).click();
  await expect(page).toHaveURL(`/app/${created.id}/insights`);
  await expect(
    page.getByRole("link", { name: "Renamed · card", exact: true }),
  ).toBeVisible();
  const allCards = page.getByRole("region", { name: "Insights", exact: true });
  await expect(allCards.getByRole("listitem")).toHaveCount(9);
  await page.goto(`/app/${created.id}/insights?favorites=false`);
  await expect(allCards.getByRole("listitem")).toHaveCount(9);
  await expect(page.getByRole("table")).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Add Renamed · card to favorites",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Remove Renamed · card from favorites",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Remove Renamed · card from favorites",
      exact: true,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.screenshot({
    path: testInfo.outputPath("insights-grid.png"),
    fullPage: true,
  });
});
