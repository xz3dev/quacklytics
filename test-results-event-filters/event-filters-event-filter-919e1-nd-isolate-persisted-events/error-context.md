# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: event-filters.spec.ts >> event filters search, combine, edit, clear, and isolate persisted events
- Location: tests/e2e/event-filters.spec.ts:5:1

# Error details

```
Error: {"error":"Session already belongs to another person"}

expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | import { z } from "zod";
  3   | import { project } from "../../packages/contracts/src/index";
  4   | 
  5   | test("event filters search, combine, edit, clear, and isolate persisted events", async ({
  6   |   page,
  7   |   baseURL,
  8   | }, testInfo) => {
  9   |   if (!baseURL) throw new Error("Missing test origin");
  10  |   const errors: string[] = [];
  11  |   page.on("pageerror", (error) => errors.push(error.message));
  12  |   const setup = z
  13  |     .object({ adminRegistered: z.boolean() })
  14  |     .parse(await (await page.request.get("/api/setup")).json());
  15  |   const login = await page.request.post(
  16  |     `/api/auth/${setup.adminRegistered ? "sign-in" : "sign-up"}/email`,
  17  |     {
  18  |       headers: { Origin: baseURL },
  19  |       data: {
  20  |         email: "migration@example.com",
  21  |         password: "Migration-test-password-42",
  22  |         name: "Migration",
  23  |       },
  24  |     },
  25  |   );
  26  |   expect(login.ok(), await login.text()).toBeTruthy();
  27  |   const createProject = async (name: string) => {
  28  |     const response = await page.request.post("/api/projects", {
  29  |       data: { name },
  30  |     });
  31  |     expect(response.ok()).toBeTruthy();
  32  |     return project.parse(await response.json());
  33  |   };
  34  |   const created = await createProject("Event filters");
  35  |   const other = await createProject("Empty schema");
  36  |   const keys = z
  37  |     .array(z.object({ key: z.string() }))
  38  |     .parse(
  39  |       await (await page.request.post(`/api/${created.id}/apikeys`)).json(),
  40  |     );
  41  |   const key = keys.at(-1);
  42  |   if (!key) throw new Error("Missing API key");
  43  |   const ingest = await page.request.post("/api/ingest", {
  44  |     headers: { "X-API-KEY": key.key },
  45  |     data: {
  46  |       requestId: crypto.randomUUID(),
  47  |       events: [
  48  |         {
  49  |           eventType: "demo.funnel.trial_started",
  50  |           properties: {
  51  |             browser: "Firefox",
  52  |             plan: "pro",
  53  |             trial_days: 14,
  54  |             active: true,
  55  |           },
  56  |         },
  57  |         {
  58  |           eventType: "demo.funnel.trial_started",
  59  |           properties: {
  60  |             browser: "Safari",
  61  |             plan: "free",
  62  |             trial_days: 7,
  63  |             active: false,
  64  |           },
  65  |         },
  66  |         {
  67  |           eventType: "demo.funnel.pricing_viewed",
  68  |           properties: { browser: "Firefox", plan: "pro" },
  69  |         },
  70  |         {
  71  |           eventType: "demo.path.home",
  72  |           properties: { duration_seconds: 12, page: "/home" },
  73  |         },
  74  |         { eventType: "heartbeat", properties: {} },
  75  |       ].map((event, index) => ({
  76  |         ...event,
  77  |         id: crypto.randomUUID(),
  78  |         timestamp: new Date().toISOString(),
  79  |         personId: `schema-person-${index}`,
  80  |         sessionId: "schema-session",
  81  |       })),
  82  |     },
  83  |   });
> 84  |   expect(ingest.ok(), await ingest.text()).toBeTruthy();
      |                                            ^ Error: {"error":"Session already belongs to another person"}
  85  |   await page.goto(`/app/${created.id}/events`);
  86  |   const rows = page.locator("tbody tr");
  87  |   await expect(rows).toHaveCount(5);
  88  |   await expect(page.getByRole("textbox", { name: "Events query" })).toHaveCount(
  89  |     0,
  90  |   );
  91  | 
  92  |   const selectField = async (field: string) => {
  93  |     await page
  94  |       .getByRole("combobox", { name: "Filter field", exact: true })
  95  |       .click();
  96  |     await page.getByPlaceholder("Search field...").fill(field);
  97  |     await page
  98  |       .getByRole("option", {
  99  |         name: `${field} ${field === "trial_days" ? "number" : "string"}`,
  100 |         exact: true,
  101 |       })
  102 |       .click();
  103 |   };
  104 |   const selectValue = async (value: string, custom = false) => {
  105 |     await page
  106 |       .getByRole("combobox", { name: "Filter value", exact: true })
  107 |       .click();
  108 |     await page.getByPlaceholder("Enter value", { exact: true }).fill(value);
  109 |     await page
  110 |       .getByRole("option", {
  111 |         name: custom ? `Use “${value}”` : value,
  112 |         exact: true,
  113 |       })
  114 |       .click();
  115 |   };
  116 |   const addFilter = async (
  117 |     field: string,
  118 |     value: string,
  119 |     operator = "=",
  120 |     custom = false,
  121 |   ) => {
  122 |     await page.getByRole("button", { name: "Add Filter", exact: true }).click();
  123 |     await expect(
  124 |       page.getByRole("button", { name: "Create", exact: true }),
  125 |     ).toBeDisabled();
  126 |     await selectField(field);
  127 |     if (operator !== "=") {
  128 |       await page
  129 |         .getByRole("combobox", { name: "Filter operator", exact: true })
  130 |         .click();
  131 |       await page.getByRole("option", { name: operator, exact: true }).click();
  132 |     }
  133 |     await selectValue(value, custom);
  134 |     await page.getByRole("button", { name: "Create", exact: true }).click();
  135 |   };
  136 |   await addFilter("browser", "Firefox");
  137 |   await expect(rows).toHaveCount(2);
  138 |   await expect(
  139 |     page.getByRole("cell", { name: "demo.funnel.pricing_viewed", exact: true }),
  140 |   ).toBeVisible();
  141 |   await addFilter("event_type", "demo.funnel.trial_started");
  142 |   await expect(rows).toHaveCount(1);
  143 |   await expect(rows).toContainText("trial_started");
  144 |   await expect(rows).toContainText("schema-person-0");
  145 |   await page
  146 |     .getByRole("button", { name: "browser = Firefox", exact: true })
  147 |     .click();
  148 |   await selectValue("Safari");
  149 |   await page.getByRole("button", { name: "Update", exact: true }).click();
  150 |   await expect(rows).toContainText("schema-person-1");
  151 |   await page
  152 |     .getByRole("button", { name: "Remove browser filter", exact: true })
  153 |     .click();
  154 |   await expect(rows).toHaveCount(2);
  155 |   await addFilter("trial_days", "10", ">", true);
  156 |   await expect(rows).toHaveCount(1);
  157 |   await expect(rows).toContainText("schema-person-0");
  158 |   await page
  159 |     .getByRole("button", { name: "Clear filters", exact: true })
  160 |     .click();
  161 |   await expect(rows).toHaveCount(5);
  162 |   await addFilter("browser", "O'Reilly", "=", true);
  163 |   await expect(
  164 |     page.getByText("No events match your filters.", { exact: true }),
  165 |   ).toBeVisible();
  166 |   await expect(page.getByRole("alert")).toHaveCount(0);
  167 |   await page
  168 |     .getByRole("button", { name: "Clear filters", exact: true })
  169 |     .click();
  170 |   await addFilter("browser", "Firefox,Safari", "IN", true);
  171 |   await expect(rows).toHaveCount(3);
  172 |   await page
  173 |     .getByRole("button", { name: "Clear filters", exact: true })
  174 |     .click();
  175 |   await addFilter("trial_days", "invalid", ">", true);
  176 |   await expect(page.getByRole("alert")).toContainText(
  177 |     "Enter a valid number for trial_days.",
  178 |   );
  179 |   await page
  180 |     .getByRole("button", { name: "Clear filters", exact: true })
  181 |     .click();
  182 |   await expect(page.getByRole("alert")).toHaveCount(0);
  183 |   await expect(rows).toHaveCount(5);
  184 |   await page.reload();
```