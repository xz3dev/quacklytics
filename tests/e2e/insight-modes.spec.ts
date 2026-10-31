import { loginAsAdmin } from "../support/auth";
import { expect, test } from "@playwright/test";
import {
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";

// One test per insight type: each walks its own view, edit, save and failure
// flows against a fresh project.
for (const definition of Object.values(defaultInsights)) {
  test(`${definition.type} insight modes isolate temporary timeframes, save defaults, and retain failed edits`, async ({
    page,
    baseURL,
  }) => {
    if (!baseURL) throw new Error("Missing test origin");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginAsAdmin(page, baseURL);
    const created = project.parse(
      await (
        await page.request.post("/api/projects", {
          data: { name: `Insight modes ${definition.type}` },
        })
      ).json(),
    );
    const base = `/api/${created.id}/insights`;
    const originals = insight
      .array()
      .parse(await (await page.request.get(base)).json());
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.request.post(base, {
      data: { ...definition, name: `Modes ${definition.type}` },
    });
    expect(response.ok()).toBeTruthy();
    const saved = insight.parse(await response.json());
    const url = `${base}/${saved.id}`;
    const read = async () =>
      insight.parse(await (await page.request.get(url)).json());
    const button = (name: string) =>
      page.getByRole("button", { name, exact: true });
    const chooseRange = async (from: string, to: string) => {
      await button(from).click();
      await page.getByRole("menuitem", { name: to, exact: true }).click();
      await expect(button(to)).toBeVisible();
    };
    const viewUrl = `/app/${created.id}/insights/${saved.id}`;
    const editUrl = `${viewUrl}/edit`;
    await page.goto(viewUrl);
    await expect(button("Edit")).toBeVisible();
    const timeframeHint = page.getByText(
      "Temporary timeframe. Edit to save as default.",
      { exact: true },
    );
    await expect(timeframeHint).toHaveCount(0);
    if (saved.type === "Trend" || saved.type === "Value") {
      const plot = page.locator("[data-chart-minimum]");
      const bottom = () =>
        page
          .locator("[data-chart-layout]")
          .evaluate(
            (element) =>
              element.getBoundingClientRect().bottom + window.scrollY,
          );
      await expect(plot).toBeVisible();
      await expect.poll(bottom).toBeGreaterThan(970);
      await expect.poll(bottom).toBeLessThanOrEqual(977);
      const height = await plot.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      await page.setViewportSize({ width: 1440, height: 1400 });
      await expect
        .poll(() =>
          plot.evaluate((element) => element.getBoundingClientRect().height),
        )
        .toBeGreaterThan(height + 390);
      await page.screenshot({
        path: `output/chart-space-empty-${saved.type.toLowerCase()}.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await expect.poll(bottom).toBeLessThanOrEqual(977);
    }
    await expect(button("Save")).toHaveCount(0);
    await expect(button("Add Series")).toHaveCount(0);
    await expect(
      page.getByLabel("Chart breakdown", { exact: true }),
    ).toHaveCount(0);
    const settings =
      saved.type === "Trend"
        ? button("Add Series")
        : saved.type === "Value"
          ? page.getByRole("button", { name: "Add Filter", exact: true })
          : saved.type === "Funnel"
            ? button("Add Step")
            : page.getByText(`${saved.type} Settings`, { exact: true });
    await expect(settings).toHaveCount(0);
    await chooseRange("Last 30 days", "Last 7 days");
    await expect(timeframeHint).toBeVisible();
    await chooseRange("Last 7 days", "Last 30 days");
    await expect(timeframeHint).toHaveCount(0);
    await chooseRange("Last 30 days", "Last 7 days");
    await expect(timeframeHint).toBeVisible();
    expect(await read()).toEqual(saved);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(button("Last 30 days")).toBeVisible();
    await expect(button("Save")).toBeDisabled();
    await expect(settings).toBeVisible();
    const sidebar = page.getByRole("complementary", {
      name: "Insight settings",
    });
    const results = page.getByRole("region", { name: "Insight results" });
    await expect(sidebar).toBeVisible();
    await expect(results).toBeVisible();
    const sidebarBox = await sidebar.boundingBox();
    const resultsBox = await results.boundingBox();
    if (!sidebarBox || !resultsBox) throw new Error("Missing editor layout");
    expect(sidebarBox.x + sidebarBox.width).toBeLessThanOrEqual(resultsBox.x);
    // Maps are already grouped by country and offer no further breakdown.
    await expect(
      results.getByLabel("Chart breakdown", { exact: true }),
    ).toHaveCount(saved.type === "Map" ? 0 : 1);
    const chartControls = results.getByRole("group", {
      name: "Chart controls",
    });
    await expect(
      chartControls.getByRole("button", { name: "Last 30 days", exact: true }),
    ).toBeVisible();
    const controlsBox = await chartControls.boundingBox();
    if (!controlsBox) throw new Error("Missing chart controls");
    expect(controlsBox.x).toBeGreaterThanOrEqual(resultsBox.x);
    await expect(chartControls.getByLabel("Effective date range")).toHaveText(
      /^[A-Z][a-z]{2} \d{1,2}, \d{4} - [A-Z][a-z]{2} \d{1,2}, \d{4}$/,
    );
    await expect(
      sidebar.getByLabel("Chart breakdown", { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `output/insight-sidebar-${saved.type.toLowerCase()}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileSettings = await sidebar.boundingBox();
    const mobileResults = await results.boundingBox();
    if (!mobileSettings || !mobileResults)
      throw new Error("Missing mobile editor");
    expect(mobileSettings.y + mobileSettings.height).toBeLessThanOrEqual(
      mobileResults.y,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(
      page.getByText("Save to use this timeframe", { exact: false }),
    ).toBeVisible();
    if (saved.type === "Trend")
      await expect(button("Add Series")).toBeVisible();
    await chooseRange("Last 30 days", "Last 14 days");
    await expect(page).toHaveURL(editUrl);
    await expect(button("Edit")).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(viewUrl);
    await expect(button("Last 30 days")).toBeVisible();
    expect(await read()).toEqual(saved);
    await page.goForward();
    await expect(page).toHaveURL(editUrl);
    await expect(button("Last 30 days")).toBeVisible();
    await chooseRange("Last 30 days", "Last 14 days");
    await button("Discard Changes").click();
    await expect(page).toHaveURL(viewUrl);
    expect(await read()).toEqual(saved);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(button("Last 30 days")).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(editUrl);
    await expect(settings).toBeVisible();
    await chooseRange("Last 30 days", "Last 14 days");
    if (saved.type === "Trend") {
      await button("Add Series").click();
      await page.getByRole("combobox", { name: "Time grouping" }).click();
      await page.getByRole("option", { name: "Week", exact: true }).click();
    }
    if (saved.type === "Value") {
      await sidebar.getByRole("button", { name: "COUNT", exact: true }).click();
      await page
        .getByRole("menuitem", { name: "Distinct Users", exact: true })
        .click();
    }
    if (saved.type === "Retention")
      await sidebar.getByLabel("Periods", { exact: true }).fill("21");
    if (saved.type === "Path")
      await sidebar.getByLabel("Steps", { exact: true }).fill("4");
    if (saved.type === "Breakdown")
      await sidebar.getByLabel("Limit", { exact: true }).fill("7");
    if (saved.type === "Funnel")
      await sidebar
        .getByRole("button", { name: "Add Step", exact: true })
        .click();
    await page.route(`**${url}`, async (route) => {
      if (route.request().method() === "PUT")
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Save failed" }),
        });
      else await route.continue();
    });
    await button("Save").click();
    await expect(page.getByRole("alert")).toContainText(
      "Could not save changes",
    );
    await expect(button("Last 14 days")).toBeVisible();
    expect(await read()).toEqual(saved);
    await page.unroute(`**${url}`);
    await button("Save").click();
    await expect(page).toHaveURL(viewUrl);
    await expect(button("Edit")).toBeVisible();
    await expect(button("Save")).toHaveCount(0);
    await expect(button("Last 14 days")).toBeVisible();
    const persisted = await read();
    await expect(timeframeHint).toHaveCount(0);
    expect(Object.values(persisted.config)[0]?.duration).toBe("P14D");
    if (persisted.type === "Trend") {
      expect(persisted.config.trend.series).toHaveLength(2);
      expect(persisted.config.trend.timeBucket).toBe("Weekly");
    }
    if (persisted.type === "Value") {
      expect(
        persisted.config.value.series.query.aggregations?.[0]?.field?.name,
      ).toBe("person_id");
      expect(
        persisted.config.value.series.query.aggregations?.[0]?.distinct,
      ).toBe(true);
    }
    if (persisted.type === "Retention")
      expect(persisted.config.retention.maxPeriods).toBe(21);
    if (persisted.type === "Path")
      expect(persisted.config.path.maxSteps).toBe(4);
    if (persisted.type === "Breakdown")
      expect(persisted.config.breakdown.limit).toBe(7);
    if (persisted.type === "Funnel" && saved.type === "Funnel")
      expect(persisted.config.funnel.steps).toHaveLength(
        (saved.config.funnel.steps?.length ?? 0) + 1,
      );
    await chooseRange("Last 14 days", "Last 7 days");
    await expect(timeframeHint).toBeVisible();
    await page.reload();
    await expect(button("Last 14 days")).toBeVisible();
    await expect(timeframeHint).toHaveCount(0);
    expect(await read()).toEqual(persisted);
    const all = insight
      .array()
      .parse(await (await page.request.get(base)).json());
    expect(
      all.filter((item) =>
        originals.some((original) => original.id === item.id),
      ),
    ).toEqual(originals);
    expect(errors).toEqual([]);
  });
}
