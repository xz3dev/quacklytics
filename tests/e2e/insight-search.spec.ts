import { loginAsAdmin } from "../support/auth";
import { expect, test } from "@playwright/test";
import {
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";

test("insight search filters immediately, clears, and respects favorites", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing origin");
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const created = project.parse(
    await (
      await page.request.post("/api/projects", { data: { name: "Search" } })
    ).json(),
  );
  const api = `/api/${created.id}/insights`;
  for (const favorite of [true, false]) {
    const response = await page.request.post(api, {
      data: {
        ...defaultInsights.Value,
        name: favorite ? "Monthly revenue" : "Annual revenue",
        favorite,
      },
    });
    expect(response.ok()).toBeTruthy();
  }
  const before = insight
    .array()
    .parse(await (await page.request.get(api)).json());
  await page.goto(`/app/${created.id}/insights`);
  const search = page.getByRole("searchbox", { name: "Search insights" });
  const cards = page
    .getByRole("region", { name: "Insights", exact: true })
    .getByRole("listitem");
  await expect(cards).toHaveCount(before.length);
  const searchBounds = await search.boundingBox();
  const createBounds = await page
    .getByRole("button", { name: "Create New Insight" })
    .boundingBox();
  if (!searchBounds || !createBounds)
    throw new Error("Missing header controls");
  expect(searchBounds.x + searchBounds.width).toBeLessThanOrEqual(
    createBounds.x,
  );
  await search.fill("  REVENUE  ");
  await expect(cards).toHaveCount(2);
  await expect(
    cards.getByRole("link", { name: "Monthly revenue", exact: true }),
  ).toBeVisible();
  await expect(
    cards.getByRole("link", { name: "Annual revenue", exact: true }),
  ).toBeVisible();
  await search.fill("monthly");
  await expect(cards).toHaveCount(1);
  await search.fill("value");
  await expect(cards).toHaveCount(
    before.filter((item) => item.type === "Value").length,
  );
  await search.fill("nothing matches this");
  await expect(cards).toHaveCount(0);
  await expect(
    page.getByText("No insights found", { exact: true }),
  ).toBeVisible();
  await search.fill("");
  await expect(cards).toHaveCount(before.length);
  await page.goto(`/app/${created.id}/insights?favorites=true`);
  await search.fill("revenue");
  const favorites = page
    .getByRole("region", { name: "Favorite Insights" })
    .getByRole("listitem");
  await expect(favorites).toHaveCount(1);
  await expect(
    favorites.getByRole("link", { name: "Monthly revenue", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(search).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create New Insight" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(
    insight.array().parse(await (await page.request.get(api)).json()),
  ).toEqual(before);
});
