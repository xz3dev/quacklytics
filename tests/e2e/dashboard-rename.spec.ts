import { loginAsAdmin } from "../support/auth";
import { expect, test } from "@playwright/test";
import { dashboard, project } from "../../packages/contracts/src/index";

test("dashboard title renames inline on blur and discards on Escape", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing test origin");
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
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

  const rename = page.getByRole("button", {
    name: "Rename dashboard",
    exact: true,
  });
  const input = page.getByRole("textbox", {
    name: "Dashboard name",
    exact: true,
  });
  const heading = page.getByRole("heading", { level: 1 });
  const savedDashboard = async () =>
    dashboard.parse(
      await (await page.request.get(`${base}/${empty.id}`)).json(),
    );
  await rename.click();
  await expect(input).toBeFocused();
  await expect(heading).toHaveCount(0);
  await expect(rename).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^(Save|Cancel|Discard)$/ }),
  ).toHaveCount(0);
  await input.fill("Renamed inline");
  await input.press("Tab");
  await expect(heading).toHaveText("Renamed inline");
  await page.reload();
  await expect(heading).toHaveText("Renamed inline");
  expect((await savedDashboard()).name).toBe("Renamed inline");

  let writes = 0;
  const saveUrl = `**${base}/${empty.id}`;
  await page.route(saveUrl, async (route) => {
    if (route.request().method() === "PUT") writes += 1;
    await route.continue();
  });
  await rename.click();
  await input.fill("Discard this");
  await input.press("Escape");
  await expect(rename).toBeFocused();
  await expect(heading).toHaveText("Renamed inline");
  await rename.click();
  await expect(input).toHaveValue("Renamed inline");
  await input.fill("   ");
  await input.press("Tab");
  await expect(heading).toHaveText("Renamed inline");
  expect((await savedDashboard()).name).toBe("Renamed inline");
  expect(writes).toBe(0);
  await page.unroute(saveUrl);

  await page.route(saveUrl, async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Save failed" }),
      });
    } else await route.continue();
  });
  await rename.click();
  await input.fill("Retry this name");
  await input.press("Tab");
  await expect(page.getByRole("alert")).toContainText(
    "Could not rename dashboard",
  );
  await expect(input).toHaveValue("Retry this name");
  expect((await savedDashboard()).name).toBe("Renamed inline");
  await page.unroute(saveUrl);
  await input.press("Enter");
  await expect(heading).toHaveText("Retry this name");
  await page.reload();
  await expect(heading).toHaveText("Retry this name");
  expect(await savedDashboard()).toEqual({ ...empty, name: "Retry this name" });
  expect(
    dashboard.parse(
      await (await page.request.get(`${base}/${home.id}`)).json(),
    ),
  ).toEqual(home);
});
