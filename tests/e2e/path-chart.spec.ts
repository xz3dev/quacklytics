import { loginAsAdmin } from "../support/auth";
import { test, expect } from "@playwright/test";
import { z } from "zod";
import {
  defaultInsights,
  insight,
  project,
} from "../../packages/contracts/src/index";

test("repeated path destinations keep distances separate in insights and dashboards", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120000);
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const createdProject = project.parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Repeated path steps" },
      })
    ).json(),
  );
  const keys = z
    .array(z.object({ key: z.string() }))
    .parse(
      await (
        await page.request.post(`/api/${createdProject.id}/apikeys`)
      ).json(),
    );
  const key = keys.at(-1)?.key;
  if (!key) throw new Error("Missing API key");

  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const events = ["desktop", "desktop", "mobile"].flatMap((device, actor) =>
    ["home", "board", "board", "home"].map((eventType, step) => ({
      id: crypto.randomUUID(),
      eventType,
      personId: `person-${actor}`,
      sessionId: `session-${actor}`,
      timestamp: new Date(
        Date.now() - 2 * 86400000 + step * 1000,
      ).toISOString(),
      properties: { device },
    })),
  );
  const ingested = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key },
    data: { requestId: crypto.randomUUID(), events },
  });
  expect(ingested.ok(), await ingested.text()).toBeTruthy();
  const ids: number[] = [];
  for (const direction of ["forward", "backward"]) {
    for (const grouped of [false, true]) {
      const name = `${direction} paths ${grouped ? "by device" : "total"}`;
      const response = await page.request.post(
        `/api/${createdProject.id}/insights`,
        {
          data: {
            ...defaultInsights.Path,
            name,
            ...(grouped
              ? {
                  breakdownBy: {
                    name: "device",
                    type: "string",
                    isProperty: true,
                  },
                }
              : {}),
            config: {
              path: {
                ...defaultInsights.Path.config.path,
                direction,
                maxSteps: 2,
                anchorQuery: {
                  filters: [
                    {
                      field: { name: "event_type", type: "string" },
                      operator: "=",
                      value: "home",
                    },
                  ],
                },
              },
            },
          },
        },
      );
      expect(response.ok(), await response.text()).toBeTruthy();
      const saved = insight.parse(await response.json());
      ids.push(saved.id);
      await page.goto(`/app/${createdProject.id}/insights/${saved.id}`);
      const chart = page.getByRole("img", { name, exact: true });
      await expect(chart).toBeVisible();
      await expect(page.locator("[data-chart-minimum]")).toHaveCount(1);
      const bars = chart.locator(".ts-chart__bar-y rect");
      await expect(bars).toHaveCount(grouped ? 4 : 2);
      const timing = direction === "forward" ? "after" : "before";
      for (const distance of [1, 2]) {
        await bars.nth(distance - 1).hover();
        const tooltip = page.getByRole("status");
        await expect(tooltip).toHaveAccessibleName(
          new RegExp(`home → board · ${distance} steps? ${timing}`),
        );
        if (grouped) {
          await expect(tooltip).toHaveAccessibleName(/desktop: 2 transitions$/);
          await bars.nth(distance + 1).hover();
          await expect(tooltip).toHaveAccessibleName(
            new RegExp(`home → board · ${distance} steps? ${timing}`),
          );
          await expect(tooltip).toHaveAccessibleName(/mobile: 1 transition$/);
        } else {
          await expect(tooltip).toHaveAccessibleName(/Value: 3 transitions$/);
        }
      }
      await page.reload();
      await expect(bars).toHaveCount(grouped ? 4 : 2);
    }
  }
  const response = await page.request.post(
    `/api/${createdProject.id}/dashboards`,
    { data: { name: "Repeated paths", favorite: false } },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  const dashboard = z.object({ id: z.number() }).parse(await response.json());
  expect(
    (
      await page.request.put(
        `/api/${createdProject.id}/dashboards/${dashboard.id}/insights`,
        { data: { insight_ids: ids } },
      )
    ).ok(),
  ).toBeTruthy();
  await page.goto(`/app/${createdProject.id}/dashboards/${dashboard.id}`);
  await expect(page.locator("[data-chart-minimum]")).toHaveCount(4);
  await expect(page.locator(".ts-chart__bar-y rect")).toHaveCount(12);
  await expect(page.getByText("Something went wrong!")).toHaveCount(0);
  expect(errors).toEqual([]);
});
