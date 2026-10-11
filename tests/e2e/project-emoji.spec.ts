import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../support/auth";
import { project } from "../../packages/contracts/src/index";

test("project emoji selection persists, clears, validates, and stays isolated", async ({
  page,
  baseURL,
}) => {
  page.setDefaultTimeout(10000);
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const create = async (name: string) =>
    project.parse(
      await (
        await page.request.post("/api/projects", { data: { name } })
      ).json(),
    );
  const current = await create("Emoji project");
  const other = await create("Other project");
  const read = async () =>
    project
      .array()
      .parse(await (await page.request.get("/api/projects")).json());
  await page.goto(`/app/${current.id}`);
  const switcher = page.getByRole("button", {
    name: "Select project",
    exact: true,
  });
  const edit = async () => {
    await switcher.click();
    await page
      .getByRole("menuitem", { name: `Rename ${current.name}`, exact: true })
      .click();
  };
  await edit();
  await page.getByRole("button", { name: "Choose project emoji" }).click();
  await expect(
    page.getByRole("button", { name: "grinning face", exact: true }),
  ).toBeVisible();
  const search = page.getByRole("textbox", {
    name: "Type to search for an emoji",
  });
  await search.fill("rocket");
  await expect(search).toHaveValue("rocket");
  await page.getByRole("button", { name: "rockets", exact: true }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(switcher).toContainText("🚀");
  await page.reload();
  await expect(switcher).toContainText("🚀");
  await switcher.click();
  await expect(
    page.getByRole("menuitem", { name: `🚀 ${current.name}`, exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  expect((await read()).find((p) => p.id === other.id)).toEqual(other);

  for (const emoji of ["👩🏽‍💻", "🇩🇪", "1️⃣", "👨‍👩‍👧‍👦"]) {
    const response = await page.request.post(`/api/${current.id}/settings`, {
      data: [{ key: "emoji", value: emoji }],
    });
    expect(response.ok()).toBeTruthy();
    await page.reload();
    await expect(switcher).toContainText(emoji);
  }
  const beforeInvalid = await read();
  const invalid = await page.request.post(`/api/${current.id}/settings`, {
    data: [
      { key: "name", value: "Should not change" },
      { key: "emoji", value: "not an emoji" },
    ],
  });
  expect(invalid.status()).toBe(400);
  expect(await read()).toEqual(beforeInvalid);

  await edit();
  await page.getByRole("button", { name: "Remove emoji" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(switcher).toContainText("👨‍👩‍👧‍👦");
  await edit();
  await page.getByRole("button", { name: "Remove emoji" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(switcher).not.toContainText("👨‍👩‍👧‍👦");
  await expect(switcher.locator("div").first()).toHaveText("E");
  await page.reload();
  await expect(switcher.locator("div").first()).toHaveText("E");
  expect((await read()).find((p) => p.id === current.id)?.emoji).toBe("");
  expect((await read()).find((p) => p.id === other.id)).toEqual(other);
});
