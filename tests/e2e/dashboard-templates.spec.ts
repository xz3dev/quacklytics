import { test, expect } from "@playwright/test";
import { z } from "zod";
import {
  dashboard,
  insight,
  project,
} from "../../packages/contracts/src/index";

test("chart playground is dev-only and saves isolated, editable chart configurations", async ({
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
  expect(login.ok(), await login.text()).toBeTruthy();
  const createProject = async (name: string) => {
    const response = await page.request.post("/api/projects", {
      data: { name },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    return project.parse(await response.json());
  };
  const first = await createProject("Template playground");
  const other = await createProject("Template isolation");
  const base = `/api/${first.id}/dashboards`;
  const getDashboards = async (url = base) =>
    dashboard.array().parse(await (await page.request.get(url)).json());
  const original = await getDashboards();
  const isolated = await getDashboards(`/api/${other.id}/dashboards`);
  expect(original).toHaveLength(1);
  expect(original[0]?.insights.map((item) => item.type)).toEqual([
    "Trend",
    "Value",
    "Breakdown",
  ]);
  const initialInsights = insight
    .array()
    .parse(await (await page.request.get(`/api/${first.id}/insights`)).json());
  await page.goto(`/app/${first.id}/dashboards`);
  const button = page.getByRole("button", {
    name: "Chart playground (dev)",
    exact: true,
  });
  const emptyResponse = await page.request.post(base, {
    data: { name: "Empty", favorite: false },
  });
  expect(emptyResponse.ok()).toBeTruthy();
  const empty = dashboard.parse(await emptyResponse.json());
  if (process.env.E2E_DEV !== "1") {
    await expect(button).toHaveCount(0);
    for (const url of [
      `${base}/templates/chart_playground`,
      `${base}/${empty.id}/templates/chart_playground`,
    ]) {
      const response = await page.request.post(url, { data: {} });
      expect(response.status()).toBe(404);
    }
    expect(await getDashboards()).toEqual([...original, empty]);
    expect(
      await (await page.request.get(`/api/${first.id}/insights`)).json(),
    ).toEqual(initialInsights);
    await page.goto(`/app/${first.id}/dashboards/${empty.id}`);
    await expect(
      page.getByRole("button", { name: "Apply web analytics template" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Apply chart playground (dev)" }),
    ).toHaveCount(0);
    return;
  }
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/templates/chart_playground") &&
      response.request().method() === "POST",
  );
  await button.click();
  const response = await created;
  expect(response.ok(), await response.text()).toBeTruthy();
  const playground = dashboard.parse(await response.json());
  expect(playground.name).toBe("Chart playground (dev)");
  expect(playground.home).toBe(false);
  expect(playground.insights.map((item) => item.type)).toEqual([
    "Trend",
    "Value",
    "Breakdown",
    "Funnel",
    "Retention",
    "Path",
  ]);
  await page.reload();
  await expect(
    page.getByRole("link", { name: playground.name, exact: true }),
  ).toBeVisible();
  expect(
    (await getDashboards()).find((item) => item.id === playground.id),
  ).toEqual(playground);
  expect((await getDashboards()).find((item) => item.home)).toEqual(
    original[0],
  );
  await page.goto(`/app/${first.id}/dashboards/${empty.id}`);
  const applied = page.waitForResponse((response) =>
    response.url().endsWith(`/${empty.id}/templates/chart_playground`),
  );
  await page
    .getByRole("button", { name: "Apply chart playground (dev)" })
    .click();
  const appliedResponse = await applied;
  expect(appliedResponse.ok(), await appliedResponse.text()).toBeTruthy();
  const filled = dashboard.parse(await appliedResponse.json());
  expect(filled.name).toBe("Empty");
  expect(filled.insights).toHaveLength(6);
  expect(
    filled.insights.every(
      (item) =>
        !playground.insights.some(
          (otherInsight) => otherInsight.id === item.id,
        ),
    ),
  ).toBe(true);
  const conflict = await page.request.post(
    `${base}/${empty.id}/templates/chart_playground`,
    { data: {} },
  );
  expect(conflict.status()).toBe(409);
  expect((await getDashboards()).find((item) => item.id === empty.id)).toEqual(
    filled,
  );
  expect(
    insight
      .array()
      .parse(
        await (await page.request.get(`/api/${first.id}/insights`)).json(),
      ),
  ).toHaveLength(initialInsights.length + 12);
  expect(await getDashboards(`/api/${other.id}/dashboards`)).toEqual(isolated);
});
