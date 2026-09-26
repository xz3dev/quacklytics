import { expect, test } from "@playwright/test";
import { z } from "zod";
import {
  dashboard,
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";

test("card timeframes follow saved insights and hide only while dashboard overrides are active", async ({
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
      await page.request.post("/api/projects", {
        data: { name: "Card timeframes" },
      })
    ).json(),
  );
  const api = `/api/${created.id}`;
  const ids: number[] = [];
  for (const config of Object.values(defaultInsights)) {
    const response = await page.request.post(`${api}/insights`, {
      data: config,
    });
    expect(response.ok()).toBeTruthy();
    ids.push(insight.parse(await response.json()).id);
  }
  const board = dashboard.parse(
    await (
      await page.request.post(`${api}/dashboards`, {
        data: { name: "Timeframes", favorite: false },
      })
    ).json(),
  );
  expect(
    (
      await page.request.put(`${api}/dashboards/${board.id}/insights`, {
        data: { insight_ids: ids },
      })
    ).ok(),
  ).toBeTruthy();
  const saved = await (await page.request.get(`${api}/insights`)).json();
  await page.goto(`/app/${created.id}/dashboards/${board.id}`);
  const labels = page.getByLabel("Insight timeframe", { exact: true });
  const expected = ids.map(() => "Last 30 days");
  await expect(labels).toHaveText(expected);
  await expect(labels.first().locator("svg")).toBeVisible();
  await page.getByRole("button", { name: "Adjust", exact: true }).click();
  await expect(labels).toHaveText(expected);
  await page.getByRole("combobox", { name: "Time grouping" }).click();
  await page.getByRole("option", { name: "Day", exact: true }).click();
  await expect(labels).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reset overrides", exact: true })
    .click();
  await expect(labels).toHaveText(expected);
  await page.getByRole("button", { name: "Adjust", exact: true }).click();
  await page
    .getByRole("button", { name: "Insight timeframes", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Last 7 days", exact: true })
    .click();
  await expect(labels).toHaveCount(0);
  await page.reload();
  await expect(labels).toHaveText(expected);
  expect(await (await page.request.get(`${api}/insights`)).json()).toEqual(
    saved,
  );
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const label = labels.first();
    const header = label.locator("..");
    const title = header.locator("a");
    const labelBounds = await label.boundingBox();
    const titleBounds = await title.boundingBox();
    const headerBounds = await header.boundingBox();
    if (!labelBounds || !titleBounds || !headerBounds)
      throw new Error("Missing header bounds");
    expect(labelBounds.x).toBeGreaterThanOrEqual(
      titleBounds.x + titleBounds.width,
    );
    expect(
      Math.abs(
        labelBounds.x + labelBounds.width - headerBounds.x - headerBounds.width,
      ),
    ).toBeLessThan(2);
    await page.screenshot({
      path: testInfo.outputPath(`timeframes-${width}.png`),
      fullPage: true,
    });
  }
});
