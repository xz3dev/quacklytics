import { test, expect } from "@playwright/test";
import { z } from "zod";
import { dashboard, project } from "../../packages/contracts/src/index";

test("dashboard cards search and actions persist across reload", async ({
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
  expect(login.ok()).toBeTruthy();
  const response = await page.request.post("/api/projects", {
    data: { name: "Dashboard cards" },
  });
  expect(response.ok()).toBeTruthy();
  const createdProject = project.parse(await response.json());
  await page.addInitScript(() => localStorage.setItem("ui-theme", "light"));
  await page.goto(`/app/${createdProject.id}/dashboards`);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Dashboards", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel(/^\d+ dashboards$/)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Create New Dashboard", exact: true })
    .click();
  await page
    .getByPlaceholder("Dashboard name", { exact: true })
    .fill("List flow");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(2);
  const card = page.getByRole("article").filter({
    has: page.getByRole("link", { name: "List flow", exact: true }),
  });
  const search = page.getByRole("searchbox", { name: "Search dashboards" });
  await search.fill("  LIST FLOW  ");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(card).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "1 of 2 dashboards" }),
  ).toBeVisible();
  await search.fill("no matching dashboard");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No matching dashboards" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear search", exact: true })
    .first()
    .click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("article")).toHaveCount(2);
  await card
    .getByRole("button", { name: "Add List flow to favorites" })
    .click();
  await expect(
    card.getByRole("button", { name: "Remove List flow from favorites" }),
  ).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: /^Actions for / }).click();
  await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
  const editingCard = page
    .getByRole("article")
    .filter({ has: page.getByRole("textbox", { name: "Dashboard name" }) });
  await editingCard.getByRole("textbox").fill("Renamed list flow");
  await editingCard.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Renamed list flow", exact: true }),
  ).toBeVisible();
  await page.reload();
  const renamedCard = page.getByRole("article").filter({
    has: page.getByRole("link", { name: "Renamed list flow", exact: true }),
  });
  await expect(
    renamedCard.getByRole("button", {
      name: "Remove Renamed list flow from favorites",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("article")).toHaveCount(2);
  await renamedCard.getByRole("button", { name: /^Actions for / }).click();
  await page
    .getByRole("menuitem", { name: "Set as Home", exact: true })
    .click();
  await expect(
    renamedCard.getByText("Home dashboard", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    renamedCard.getByText("Home dashboard", { exact: true }),
  ).toBeVisible();
  const open = renamedCard.getByRole("link", {
    name: "Open dashboard: Renamed list flow",
    exact: true,
  });
  const destination = await open.getAttribute("href");
  if (!destination) throw new Error("Missing dashboard destination");
  await open.click();
  await expect(page).toHaveURL(new RegExp(`${destination}$`));
  await expect(
    page.getByRole("button", { name: "Apply web analytics template" }),
  ).toBeVisible();
  await page.goto(`/app/${createdProject.id}/dashboards`);
  const additional = await page.request.post(
    `/api/${createdProject.id}/dashboards`,
    {
      data: { name: "Acquisition overview", favorite: false },
    },
  );
  expect(additional.ok()).toBeTruthy();
  const third = dashboard.parse(await additional.json());
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(3);
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const searchBounds = await search.boundingBox();
  const createBounds = await page
    .getByRole("button", { name: "Create New Dashboard", exact: true })
    .boundingBox();
  if (!searchBounds || !createBounds)
    throw new Error("Missing header controls");
  expect(searchBounds.x + searchBounds.width).toBeLessThan(createBounds.x);
  expect(Math.abs(searchBounds.y - createBounds.y)).toBeLessThan(2);
  const cards = await page.getByRole("article").all();
  const positions = await Promise.all(cards.map((card) => card.boundingBox()));
  const [first, second, thirdPosition] = positions;
  if (!first || !second || !thirdPosition)
    throw new Error("Missing card positions");
  expect(first.height).toBeLessThan(180);
  expect(first.y).toBe(second.y);
  expect(second.x).toBeGreaterThan(first.x + first.width);
  expect(thirdPosition.x).toBe(first.x);
  expect(thirdPosition.y).toBeGreaterThan(first.y + first.height);
  await page.screenshot({
    path: "output/imagegen/dashboard-variants/implemented-cards-desktop.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Create New Dashboard", exact: true }),
  ).toBeVisible();
  await search.fill("renamed");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(renamedCard).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await page.screenshot({
    path: "output/imagegen/dashboard-variants/implemented-cards-mobile.png",
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  const removeThird = await page.request.delete(
    `/api/${createdProject.id}/dashboards/${third.id}`,
  );
  expect(removeThird.ok()).toBeTruthy();
  await page.reload();
  await renamedCard.getByRole("button", { name: /^Actions for / }).click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Renamed list flow", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByRole("article")
      .getByRole("link", { name: "Web Analytics Overview", exact: true }),
  ).toBeVisible();
});

test("dashboard mosaics show included types, empty slots, and overflow after reload", async ({
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
  expect(login.ok()).toBeTruthy();
  const response = await page.request.post("/api/projects", {
    data: { name: "Dashboard cards" },
  });
  expect(response.ok()).toBeTruthy();
  const createdProject = project.parse(await response.json());

  const base = `/api/${createdProject.id}/dashboards`;
  const templateResponse = await page.request.post(
    `${base}/templates/product_analytics`,
    {
      data: { name: "Mosaic source" },
    },
  );
  expect(templateResponse.ok()).toBeTruthy();
  const source = dashboard.parse(await templateResponse.json());
  expect(source.insights.length).toBeGreaterThan(4);
  const emptyResponse = await page.request.post(base, {
    data: { name: "Mosaic preview", favorite: false },
  });
  expect(emptyResponse.ok()).toBeTruthy();
  const target = dashboard.parse(await emptyResponse.json());
  await page.goto(`/app/${createdProject.id}/dashboards`);
  const card = page.getByRole("article", {
    name: "Mosaic preview",
    exact: true,
  });
  const mosaic = card.getByRole("group", { name: "Included insights" });
  for (const count of [0, 1, 3, 4, source.insights.length]) {
    const included = source.insights.slice(0, count);
    const saved = await page.request.put(`${base}/${target.id}/insights`, {
      data: { insight_ids: included.map((insight) => insight.id) },
    });
    expect(saved.ok()).toBeTruthy();
    await page.reload();
    await expect(mosaic.getByRole("img")).toHaveCount(4);
    await expect(
      mosaic.getByRole("img", { name: "Empty insight slot", exact: true }),
    ).toHaveCount(Math.max(0, 4 - count));
    for (const insight of included.slice(0, count > 4 ? 3 : 4)) {
      await expect(
        mosaic.getByRole("img", {
          name: `${insight.name} (${insight.type})`,
          exact: true,
        }),
      ).toBeVisible();
    }
    await expect(
      mosaic.getByRole("img", { name: /more insights/ }),
    ).toHaveCount(count > 4 ? 1 : 0);
    if (count > 4) {
      await expect(
        mosaic.getByRole("img", {
          name: `${count - 3} more insights`,
          exact: true,
        }),
      ).toBeVisible();
    }
    const illustration = await mosaic.boundingBox();
    const heading = await card.getByRole("heading").boundingBox();
    if (!illustration || !heading) throw new Error("Missing mosaic or heading");
    expect(illustration.x + illustration.width).toBeLessThan(heading.x);
  }
  const persistedSource = dashboard.parse(
    await (await page.request.get(`${base}/${source.id}`)).json(),
  );
  expect(persistedSource.insights).toEqual(source.insights);
});
