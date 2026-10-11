import { loginAsAdmin } from "../support/auth";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { project, schemaResponse } from "../../packages/contracts/src/index";

test("schema inspector filters real events, inspects values, recovers errors, and isolates projects", async ({
  page,
  baseURL,
}, testInfo) => {
  if (!baseURL) throw new Error("Missing test origin");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const createProject = async (name: string) => {
    const response = await page.request.post("/api/projects", {
      data: { name },
    });
    expect(response.ok()).toBeTruthy();
    return project.parse(await response.json());
  };
  const created = await createProject("Schema inspector");
  const other = await createProject("Empty schema");
  const keys = z
    .array(z.object({ key: z.string() }))
    .parse(
      await (await page.request.post(`/api/${created.id}/apikeys`)).json(),
    );
  const key = keys.at(-1);
  if (!key) throw new Error("Missing API key");
  const ingest = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key.key },
    data: {
      requestId: crypto.randomUUID(),
      events: [
        {
          eventType: "demo.funnel.trial_started",
          properties: {
            browser: "Firefox",
            plan: "pro",
            trial_days: 14,
            active: true,
          },
        },
        {
          eventType: "demo.funnel.trial_started",
          properties: {
            browser: "Safari",
            plan: "free",
            trial_days: 7,
            active: false,
          },
        },
        {
          eventType: "demo.funnel.pricing_viewed",
          properties: { browser: "Firefox", plan: "pro" },
        },
        {
          eventType: "demo.path.home",
          properties: { duration_seconds: 12, page: "/home" },
        },
        { eventType: "heartbeat", properties: {} },
      ].map((event) => ({
        ...event,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        personId: "schema-person",
        sessionId: "schema-session",
      })),
    },
  });
  expect(ingest.ok(), await ingest.text()).toBeTruthy();
  const persistedSchema = schemaResponse.parse(
    await (await page.request.get(`/api/${created.id}/schema`)).json(),
  );
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("ui-theme", "light"));
  await page.goto(`/app/${created.id}/data`);
  await expect(page.locator("html")).toHaveClass(/light/);
  const events = page.getByRole("list", { name: "Event list" });
  const inspector = page.getByRole("region", { name: "Event inspector" });
  await expect(
    page.getByRole("navigation", { name: "Event namespaces" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }),
  ).toHaveCount(0);
  const search = page.getByRole("textbox", { name: "Search events" });
  await expect(events.getByRole("button")).toHaveCount(4);
  await search.fill("demo.funnel");
  await expect(events.getByRole("button")).toHaveCount(2);
  await events
    .getByRole("button", { name: "demo.funnel.trial_started", exact: true })
    .click();
  await expect(
    inspector.getByRole("heading", {
      name: "demo.funnel.trial_started",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    inspector.getByRole("row").filter({ hasText: "trial_days" }),
  ).toContainText("number");
  await expect(
    inspector.getByRole("row").filter({ hasText: "active" }),
  ).toContainText("boolean");
  await expect(
    inspector.getByRole("row").filter({ hasText: "browser" }),
  ).toContainText("string");
  await expect(
    events.getByRole("button", {
      name: "demo.funnel.trial_started",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: testInfo.outputPath("schema-inspector-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const copyName = inspector.getByRole("button", {
    name: "demo.funnel.trial_started",
    exact: true,
  });
  await copyName.hover();
  await expect(
    page.getByRole("tooltip", { name: "Copy event name" }),
  ).toBeVisible();
  await copyName
    .getByText("demo.funnel.trial_started", { exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("demo.funnel.trial_started");
  const propertySearch = inspector.getByRole("textbox", {
    name: "Search properties",
  });
  await propertySearch.fill("missing");
  await expect(
    inspector.getByText("No properties match your search."),
  ).toBeVisible();
  await expect(inspector.getByRole("row")).toHaveCount(1);
  await expect(events.getByRole("button")).toHaveCount(2);
  await propertySearch.fill(" BROW ");
  await expect(inspector.getByRole("row")).toHaveCount(2);
  await expect(
    inspector.getByRole("row").filter({ hasText: "browser" }),
  ).toContainText("string");
  await inspector
    .getByRole("button", { name: "View values for browser", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Firefox", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Safari", { exact: true })).toBeVisible();
  await dialog.getByPlaceholder("Search values...").fill("sAF");
  await expect(dialog.getByText("Safari", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Firefox", { exact: true })).toHaveCount(0);
  await dialog.getByPlaceholder("Search values...").fill("missing");
  await expect(dialog.getByText("No values match this search.")).toBeVisible();
  await page.keyboard.press("Escape");
  await propertySearch.fill("");
  await expect(inspector.getByRole("row")).toHaveCount(5);
  await search.fill(" PRICING ");
  await expect(events.getByRole("button")).toHaveCount(1);
  await expect(
    inspector.getByRole("heading", {
      name: "demo.funnel.pricing_viewed",
      exact: true,
    }),
  ).toBeVisible();
  const copyPricing = inspector.getByRole("button", {
    name: "demo.funnel.pricing_viewed",
    exact: true,
  });
  await copyPricing.locator("svg").click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("demo.funnel.pricing_viewed");
  await search.focus();
  await copyPricing.focus();
  await expect(
    page.getByRole("tooltip", { name: "Copy event name" }),
  ).toBeVisible();
  await copyPricing.press("Enter");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("demo.funnel.pricing_viewed");
  await search.fill("missing");
  await expect(page.getByText("No events match your filters.")).toBeVisible();
  await expect(inspector.getByRole("table")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(events.getByRole("button")).toHaveCount(4);
  await search.fill("heartbeat");
  await expect(events.getByRole("button")).toHaveCount(1);
  await expect(
    inspector.getByText("This event has no properties."),
  ).toBeVisible();
  await page.reload();
  await expect(events.getByRole("button")).toHaveCount(4);
  expect(
    schemaResponse.parse(
      await (await page.request.get(`/api/${created.id}/schema`)).json(),
    ),
  ).toEqual(persistedSchema);

  // Failed property requests must be distinct from empty recorded values.
  await page.route(`**/api/${created.id}/schema/prop/*`, (route) =>
    route.fulfill({ status: 500, json: { error: "Values unavailable" } }),
  );
  await inspector
    .getByRole("button", { name: "View values for browser", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Could not load property values",
  );
  await page.unroute(`**/api/${created.id}/schema/prop/*`);
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByText("Firefox", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await search.fill("trial_started");
  await expect(
    inspector.getByRole("heading", {
      name: "demo.funnel.trial_started",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    inspector.getByRole("button", {
      name: "View values for trial_days",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("schema-inspector-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });

  await page.goto(`/app/${other.id}/data`);
  await expect(
    page.getByText(
      "No events yet. Send your first event to explore its schema.",
    ),
  ).toBeVisible();
  await expect(events.getByRole("button")).toHaveCount(0);
  await expect(inspector.getByRole("table")).toHaveCount(0);
  await page.route(`**/api/${created.id}/schema`, (route) =>
    route.fulfill({ status: 500, json: { error: "Schema unavailable" } }),
  );
  await page.goto(`/app/${created.id}/data`);
  await expect(page.getByRole("alert")).toContainText(
    "Could not load event schema",
  );
  await page.unroute(`**/api/${created.id}/schema`);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(events.getByRole("button")).toHaveCount(4);
  expect(errors).toEqual([]);
});
