import { expect, test } from "@playwright/test";
import { z } from "zod";
import {
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";

test("visual insight picker supports keyboard selection, retry, and persists every type", async ({
  page,
  baseURL,
}) => {
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
        data: { name: "Visual picker" },
      })
    ).json(),
  );
  const api = `/api/${created.id}/insights`;
  const read = async () =>
    insight.array().parse(await (await page.request.get(api)).json());
  const originals = await read();
  await page.goto(`/app/${created.id}/insights`);
  const dialog = page.getByRole("dialog", { name: "Create New Insight" });
  for (const definition of Object.values(defaultInsights)) {
    await page.getByRole("button", { name: "Create New Insight" }).click();
    await expect(dialog.getByRole("radio")).toHaveCount(6);
    for (const option of await dialog.locator("label").all()) {
      await expect(option.locator("svg").first()).toBeVisible();
    }
    await expect(
      dialog.getByRole("button", { name: "Create", exact: true }),
    ).toBeEnabled();
    if (definition.type === "Trend") {
      const trend = dialog.getByRole("radio", { name: "Trend", exact: true });
      await expect(trend).toBeChecked();
      await trend.focus();
      await page.keyboard.press("ArrowRight");
      await expect(trend).not.toBeChecked();
      await page.keyboard.press("ArrowLeft");
      await expect(trend).toBeChecked();
      await page.screenshot({ path: "output/insight-picker-desktop.png" });
    }
    await dialog
      .locator("label")
      .filter({
        has: page.getByRole("radio", { name: definition.type, exact: true }),
      })
      .click();
    await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(1);
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    if (definition.type === "Path") {
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(
        dialog.getByRole("radio", { name: "Path", exact: true }),
      ).toBeChecked();
      const bounds = await dialog.boundingBox();
      if (!bounds) throw new Error("Missing dialog");
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      await page.screenshot({ path: "output/insight-picker-mobile.png" });
      const beforeFailure = await read();
      await page.route(`**${api}`, async (route) => {
        if (route.request().method() === "POST")
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "Creation failed" }),
          });
        else await route.continue();
      });
      await dialog.getByRole("button", { name: "Create", exact: true }).click();
      await expect(dialog.getByRole("alert")).toContainText(
        "Could not save changes",
      );
      await expect(
        dialog.getByRole("radio", { name: "Path", exact: true }),
      ).toBeChecked();
      expect(await read()).toEqual(beforeFailure);
      await page.unroute(`**${api}`);
    }
    await dialog.getByRole("button", { name: "Create", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("link", {
        name: `Untitled ${definition.type.toLowerCase()}`,
        exact: true,
      }),
    ).toBeVisible();
    const saved = (await read()).find(
      (item) => item.name === `Untitled ${definition.type.toLowerCase()}`,
    );
    expect(saved).toMatchObject({
      type: definition.type,
      config: definition.config,
    });
  }
  await page.reload();
  for (const definition of Object.values(defaultInsights)) {
    await expect(
      page.getByRole("link", {
        name: `Untitled ${definition.type.toLowerCase()}`,
        exact: true,
      }),
    ).toBeVisible();
  }
  const all = await read();
  expect(all).toHaveLength(originals.length + 6);
  expect(
    all.filter((item) => originals.some((original) => original.id === item.id)),
  ).toEqual(originals);
});

test("inline names save in both modes without saving temporary or draft chart settings", async ({
  page,
  baseURL,
}) => {
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
        data: { name: "Visual picker" },
      })
    ).json(),
  );

  const api = `/api/${created.id}/insights`;
  const saved = insight.parse(
    await (
      await page.request.post(api, {
        data: { ...defaultInsights.Trend, name: "Activity · Daily visits" },
      })
    ).json(),
  );
  const url = `${api}/${saved.id}`;
  const read = async () =>
    insight.parse(await (await page.request.get(url)).json());
  const viewUrl = `/app/${created.id}/insights/${saved.id}`;
  await page.goto(viewUrl);
  await expect(
    page
      .locator("fieldset")
      .getByText("Activity · Daily visits", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Rename Activity · Daily visits",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Last 30 days", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Last 7 days", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Rename Activity · Daily visits",
      exact: true,
    })
    .click();
  const input = page.getByRole("textbox", {
    name: "Insight name",
    exact: true,
  });
  await expect(input).toHaveValue("Activity · Daily visits");
  await expect(input).toBeFocused();
  await expect(
    page.getByRole("button", { name: /^(Save name|Cancel rename)$/ }),
  ).toHaveCount(0);
  await input.fill("Cancelled rename");
  await input.press("Escape");
  expect(await read()).toEqual(saved);
  await page
    .getByRole("button", {
      name: "Rename Activity · Daily visits",
      exact: true,
    })
    .click();
  await input.fill("   ");
  await input.press("Tab");
  await expect(input).toHaveCount(0);
  expect(await read()).toEqual(saved);
  await page
    .getByRole("button", {
      name: "Rename Activity · Daily visits",
      exact: true,
    })
    .click();
  await input.fill("Weekly visits");
  await page.route(`**${url}`, async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Rename failed" }),
      });
    else await route.continue();
  });
  await input.press("Tab");
  await expect(page.getByRole("alert")).toContainText(
    "Could not rename insight",
  );
  await expect(input).toHaveValue("Weekly visits");
  expect(await read()).toEqual(saved);
  await page.unroute(`**${url}`);
  await input.press("Enter");
  await expect(
    page.getByRole("button", { name: "Rename Weekly visits", exact: true }),
  ).toBeVisible();
  expect(await read()).toEqual({ ...saved, name: "Weekly visits" });
  await expect(
    page.getByRole("button", { name: "Last 7 days", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Rename Weekly visits", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Last 30 days", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: "Add Series", exact: true }).click();
  await page
    .getByRole("button", { name: "Rename Weekly visits", exact: true })
    .click();
  await input.fill("Product activity");
  await input.press("Tab");
  await expect(
    page.getByRole("button", { name: "Rename Product activity", exact: true }),
  ).toBeVisible();
  expect(await read()).toEqual({ ...saved, name: "Product activity" });
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: "output/insight-inline-name.png" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(viewUrl);
  const persisted = await read();
  if (persisted.type !== "Trend") throw new Error("Unexpected insight type");
  expect(persisted.name).toBe("Product activity");
  expect(persisted.config.trend.series).toHaveLength(2);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Rename Product activity", exact: true }),
  ).toBeVisible();
});
