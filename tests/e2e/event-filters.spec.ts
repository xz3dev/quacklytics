import { loginAsAdmin } from "../support/auth";
import { expect, test } from "@playwright/test";
import { z } from "zod";
import { project, schemaResponse } from "../../packages/contracts/src/index";

test("event filters search, combine, edit, clear, and isolate persisted events", async ({
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
  const created = await createProject("Event filters");
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
      ].map((event, index) => ({
        ...event,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        personId: `schema-person-${index}`,
        sessionId: `schema-session-${index}`,
      })),
    },
  });
  expect(ingest.ok(), await ingest.text()).toBeTruthy();
  const schema = schemaResponse.parse(
    await (await page.request.get(`/api/${created.id}/schema`)).json(),
  );
  const browserId = schema["demo.funnel.pricing_viewed"]?.browser?.id;
  if (browserId === undefined) throw new Error("Missing browser schema");
  const valuesUrl = `/api/${created.id}/schema/prop/${browserId}`;
  expect(
    z
      .string()
      .array()
      .parse(await (await page.request.get(valuesUrl)).json()),
  ).toEqual(["Firefox"]);
  expect(
    z
      .string()
      .array()
      .parse(
        await (await page.request.get(`${valuesUrl}?scope=project`)).json(),
      ),
  ).toEqual(["Firefox", "Safari"]);
  await page.goto(`/app/${created.id}/events`);
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(5);
  await expect(
    page.getByRole("status", { name: "Event data: Live" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Events query" })).toHaveCount(
    0,
  );

  const selectField = async (field: string) => {
    await page
      .getByRole("combobox", { name: "Filter field", exact: true })
      .click();
    await page.getByPlaceholder("Search field...").fill(field);
    await page
      .getByRole("option", {
        name: `${field} ${field === "trial_days" ? "number" : "string"}`,
        exact: true,
      })
      .click();
  };
  const selectValue = async (value: string, custom = false) => {
    await page
      .getByRole("combobox", { name: "Filter value", exact: true })
      .click();
    await page.getByPlaceholder("Enter value", { exact: true }).fill(value);
    await page
      .getByRole("option", {
        name: custom ? `Use “${value}”` : value,
        exact: true,
      })
      .click();
  };
  const addFilter = async (
    field: string,
    value: string,
    operator = "=",
    custom = false,
  ) => {
    await page.getByRole("button", { name: "Add Filter", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Create", exact: true }),
    ).toBeDisabled();
    await selectField(field);
    if (operator !== "=") {
      await page
        .getByRole("combobox", { name: "Filter operator", exact: true })
        .click();
      await page.getByRole("option", { name: operator, exact: true }).click();
    }
    await selectValue(value, custom);
    await page.getByRole("button", { name: "Create", exact: true }).click();
  };
  await addFilter("browser", "Firefox");
  await expect(rows).toHaveCount(2);
  await expect(
    page.getByRole("cell", { name: "demo.funnel.pricing_viewed", exact: true }),
  ).toBeVisible();
  await addFilter("event_type", "demo.funnel.trial_started");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("trial_started");
  await expect(rows).toContainText("schema-person-0");
  await page
    .getByRole("button", { name: "browser = Firefox", exact: true })
    .click();
  await selectValue("Safari");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(rows).toContainText("schema-person-1");
  await page
    .getByRole("button", { name: "Remove browser filter", exact: true })
    .click();
  await expect(rows).toHaveCount(2);
  await addFilter("trial_days", "10", ">", true);
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("schema-person-0");
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(rows).toHaveCount(5);
  await addFilter("browser", "O'Reilly", "=", true);
  await expect(
    page.getByText("No events match your filters.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await addFilter("browser", "Firefox,Safari", "IN", true);
  await expect(rows).toHaveCount(3);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await addFilter("trial_days", "invalid", ">", true);
  await expect(page.getByRole("alert")).toContainText(
    "Enter a valid number for trial_days.",
  );
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(rows).toHaveCount(5);
  await page.reload();
  await expect(rows).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  await addFilter("browser", "Firefox");
  await expect(rows).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("event-filters-mobile.png"),
    fullPage: true,
  });
  await page.goto(`/app/${other.id}/events`);
  await expect(page.getByText("No events yet.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove browser filter", exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
