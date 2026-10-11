import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../support/auth";
import { project } from "../../packages/contracts/src/index";

test("projects page lists, opens and creates projects on a dedicated page", async ({
  page,
  baseURL,
}) => {
  page.setDefaultTimeout(10000);
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const read = async () =>
    project
      .array()
      .parse(await (await page.request.get("/api/projects")).json());
  const existing = project.parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Listed project" },
      })
    ).json(),
  );

  await page.goto("/projects");
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  // Rows show the project name and open the project; renaming lives in the
  // project picker.
  const row = page
    .getByRole("listitem")
    .filter({ has: page.locator(`a[href="/app/${existing.id}"]`) });
  await expect(row).toContainText("Listed project");
  await expect(row.getByRole("button")).toHaveCount(0);
  await row.getByRole("link", { name: "Listed project", exact: true }).click();
  await expect(page).toHaveURL(`/app/${existing.id}`);
  await page.goto("/projects");

  await page.getByRole("link", { name: "New project", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/new$/);
  await expect(
    page.getByRole("heading", { name: "Create a project", exact: true }),
  ).toBeVisible();
  const name = page.getByLabel("Project name", { exact: true });
  const submit = page.getByRole("button", {
    name: "Create project",
    exact: true,
  });
  await expect(name).toBeFocused();
  await name.fill("   ");
  await expect(submit).toBeDisabled();

  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  const countBefore = (await read()).length;

  await page.getByRole("link", { name: "New project", exact: true }).click();
  await name.fill("  Created in UI  ");
  await page.getByRole("button", { name: "Choose project emoji" }).click();
  await page
    .getByRole("textbox", { name: "Type to search for an emoji" })
    .fill("rocket");
  await page.getByRole("button", { name: "rockets", exact: true }).click();

  await page.route("**/api/projects", (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 500, json: { error: "Creation unavailable" } })
      : route.continue(),
  );
  await submit.click();
  await expect(page.getByRole("alert")).toContainText("Creation unavailable");
  await expect(name).toHaveValue("  Created in UI  ");
  await expect(page).toHaveURL(/\/projects\/new$/);
  expect((await read()).length).toBe(countBefore);
  await page.unroute("**/api/projects");

  await submit.click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/setup$/);
  await page.getByRole("link", { name: "Skip for now", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/[^/]+/);
  const createdId = page.url().split("/app/")[1]?.split("/")[0];
  const created = (await read()).find((p) => p.id === createdId);
  expect(created).toMatchObject({ name: "Created in UI", emoji: "🚀" });
  expect((await read()).find((p) => p.id === existing.id)).toMatchObject({
    name: "Listed project",
    emoji: "",
  });

  const switcher = page.getByRole("button", {
    name: "Select project",
    exact: true,
  });
  await expect(switcher).toContainText("🚀");
  await switcher.click();
  await page
    .getByRole("menuitem", { name: "Create new project", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects\/new$/);
  await page.getByRole("link", { name: "All projects", exact: true }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Created in UI" }),
  ).toContainText("🚀");

  const invalid = await page.request.post("/api/projects", {
    data: { name: "Bad emoji", emoji: "not an emoji" },
  });
  expect(invalid.status()).toBe(400);
  expect((await read()).some((p) => p.name === "Bad emoji")).toBe(false);
});
