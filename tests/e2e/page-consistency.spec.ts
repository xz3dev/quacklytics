import { expect, test } from "@playwright/test";
import { z } from "zod";
import { project } from "../../packages/contracts/src/index";

test("project pages share insight spacing in both themes and remain usable on mobile", async ({
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
        data: { name: "Page consistency" },
      })
    ).json(),
  );
  const routes = [
    ["insights", "Insights"],
    ["dashboards", "Dashboards"],
    ["data", "Data"],
    ["events", "Events"],
    ["queries", "Queries"],
    ["ingestion", "Ingestion"],
  ];
  for (const theme of ["light", "dark"]) {
    await page.addInitScript(
      (value) => localStorage.setItem("ui-theme", value),
      theme,
    );
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      let reference: { x: number; y: number; font: string } | undefined;
      for (const [route, title] of routes) {
        if (!route || !title) throw new Error("Missing route");
        await page.goto(`/app/${created.id}/${route}`);
        const heading = page
          .getByRole("heading", { name: title, exact: true })
          .first();
        await expect(heading).toBeVisible();
        await expect(page.locator("html")).toHaveClass(new RegExp(theme));
        const metrics = await heading.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            font: getComputedStyle(element).fontSize,
          };
        });
        reference ??= metrics;
        expect(metrics).toEqual(reference);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        if (route === "insights" || route === "dashboards") {
          const searchBounds = await page.getByRole("searchbox").boundingBox();
          expect(searchBounds?.width).toBeGreaterThanOrEqual(240);
        }
        if (route === "dashboards") {
          await page
            .getByRole("searchbox", { name: "Search dashboards" })
            .fill("no such dashboard");
          await expect(
            page.getByRole("heading", { name: "No matching dashboards" }),
          ).toBeVisible();
          await page
            .getByRole("button", { name: "Clear search", exact: true })
            .first()
            .click();
          await expect(page.getByRole("article")).toHaveCount(1);
        }
        if (route === "queries") {
          const tabs = await page.getByRole("tab").all();
          for (const tab of tabs) {
            expect(
              await tab.evaluate(
                (element) => element.scrollWidth <= element.clientWidth,
              ),
            ).toBeTruthy();
          }
          const editor = page.locator(".cm-content");
          await editor.fill("SELECT 42 AS answer");
          await page
            .getByRole("button", { name: "Execute", exact: true })
            .click();
          await expect(
            page.getByRole("cell", { name: "42", exact: true }),
          ).toBeVisible();
          await editor.fill("SELECT * FROM missing_table");
          await page
            .getByRole("button", { name: "Execute", exact: true })
            .click();
          await expect(page.getByRole("alert")).toHaveText(/^Error: .+/);
          await editor.fill("SELECT 43 AS recovered");
          await page
            .getByRole("button", { name: "Execute", exact: true })
            .click();
          await expect(
            page.getByRole("cell", { name: "43", exact: true }),
          ).toBeVisible();
          await expect(page.getByRole("alert")).toHaveCount(0);
        }
        await page.screenshot({
          path: testInfo.outputPath(`${theme}-${width}-${route}.png`),
          fullPage: true,
        });
      }
    }
  }
});
