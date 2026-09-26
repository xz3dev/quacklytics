# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chart-breakdown.spec.ts >> all charts break down by properties, persist, and restore ungrouped results
- Location: tests/e2e/chart-breakdown.spec.ts:30:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[data-chart-minimum]')
Expected: 1
Received: 0
Timeout:  20000ms

Call log:
  - Expect "toHaveCount" locator('[data-chart-minimum]') with timeout 20000ms
  - waiting for locator('[data-chart-minimum]')
    44 × locator resolved to 0 elements
       - unexpected value "0"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - alert [ref=e2]:
    - text: "Unable to load analytics: _setThrew is not defined"
    - button "Retry" [ref=e3] [cursor=pointer]
  - region "Notifications alt+T"
```

# Test source

```ts
  39  |     .object({ adminRegistered: z.boolean() })
  40  |     .parse(await (await page.request.get("/api/setup")).json());
  41  |   const login = await page.request.post(
  42  |     `/api/auth/${setup.adminRegistered ? "sign-in" : "sign-up"}/email`,
  43  |     {
  44  |       headers: { Origin: baseURL ?? "" },
  45  |       data: {
  46  |         email: "migration@example.com",
  47  |         password: "Migration-test-password-42",
  48  |         name: "Migration",
  49  |       },
  50  |     },
  51  |   );
  52  |   expect(login.ok(), await login.text()).toBeTruthy();
  53  |   const createdProject = project.parse(
  54  |     await (
  55  |       await page.request.post("/api/projects", {
  56  |         data: { name: "Breakdown charts" },
  57  |       })
  58  |     ).json(),
  59  |   );
  60  |   const keys = z
  61  |     .array(z.object({ key: z.string() }))
  62  |     .parse(
  63  |       await (
  64  |         await page.request.post(`/api/${createdProject.id}/apikeys`)
  65  |       ).json(),
  66  |     );
  67  |   const key = keys.at(-1)?.key;
  68  |   if (!key) throw new Error("Missing API key");
  69  |   const events = ["desktop", "mobile", null].flatMap((device, index) =>
  70  |     ["signup", "purchase"].map((eventType, step) => ({
  71  |       id: crypto.randomUUID(),
  72  |       eventType,
  73  |       personId: `person-${index}`,
  74  |       sessionId: `session-${index}`,
  75  |       timestamp: new Date(Date.now() - (3 - step) * 86400000).toISOString(),
  76  |       properties: device === null ? {} : { device },
  77  |     })),
  78  |   );
  79  |   const ingested = await page.request.post("/api/ingest", {
  80  |     headers: { "X-API-KEY": key },
  81  |     data: { requestId: crypto.randomUUID(), events },
  82  |   });
  83  |   expect(ingested.ok(), await ingested.text()).toBeTruthy();
  84  |   const ids: number[] = [];
  85  |   const errors: string[] = [];
  86  |   page.on("pageerror", (error) => errors.push(error.message));
  87  |   for (const definition of Object.values(defaultInsights)) {
  88  |     const configured = insight.parse({ ...definition, id: 1 });
  89  |     if (configured.type === "Trend") {
  90  |       const original = configured.config.trend.series?.[0];
  91  |       if (!original) throw new Error("Missing trend series");
  92  |       configured.config.trend.series = [
  93  |         { ...original, name: "Events", visualisation: "bar" },
  94  |         {
  95  |           ...original,
  96  |           name: "Purchases",
  97  |           visualisation: "bar",
  98  |           query: {
  99  |             ...original.query,
  100 |             filters: [
  101 |               {
  102 |                 field: { name: "event_type", type: "string" },
  103 |                 operator: "=",
  104 |                 value: "purchase",
  105 |               },
  106 |             ],
  107 |           },
  108 |         },
  109 |       ];
  110 |     }
  111 |     if (configured.type === "Funnel") {
  112 |       configured.config.funnel.steps = ["signup", "purchase"].map(
  113 |         (name, order) => ({
  114 |           id: name,
  115 |           name,
  116 |           order,
  117 |           query: {
  118 |             filters: [
  119 |               {
  120 |                 field: { name: "event_type", type: "string" },
  121 |                 operator: "=",
  122 |                 value: name,
  123 |               },
  124 |             ],
  125 |           },
  126 |         }),
  127 |       );
  128 |     }
  129 |     const response = await page.request.post(
  130 |       `/api/${createdProject.id}/insights`,
  131 |       { data: { ...configured, name: `Grouped ${definition.type}` } },
  132 |     );
  133 |     expect(response.ok(), await response.text()).toBeTruthy();
  134 |     const saved = insight.parse(await response.json());
  135 |     ids.push(saved.id);
  136 |     await page.goto(`/app/${createdProject.id}/insights/${saved.id}`);
  137 |     await page.setViewportSize({ width: 1440, height: 1000 });
  138 |     const plot = page.locator("[data-chart-minimum]");
> 139 |     await expect(plot).toHaveCount(1);
      |                        ^ Error: expect(locator).toHaveCount(expected) failed
  140 |     if (definition.type === "Trend") await expectSideBySideBars(plot, 3);
  141 |     const plotHeight = () =>
  142 |       plot.evaluate((element) => element.getBoundingClientRect().height);
  143 |     const layoutBottom = () =>
  144 |       page
  145 |         .locator("[data-chart-layout]")
  146 |         .evaluate(
  147 |           (element) => element.getBoundingClientRect().bottom + window.scrollY,
  148 |         );
  149 |     await expect.poll(layoutBottom).toBeGreaterThan(970);
  150 |     await expect.poll(layoutBottom).toBeLessThanOrEqual(977);
  151 |     const initialHeight = await plotHeight();
  152 |     await page.setViewportSize({ width: 1440, height: 1400 });
  153 |     await expect.poll(plotHeight).toBeGreaterThan(initialHeight + 390);
  154 |     await expect.poll(layoutBottom).toBeLessThanOrEqual(1377);
  155 |     if (definition.type !== "Value") {
  156 |       const graphic = plot.getByRole("img", {
  157 |         name: `Grouped ${definition.type}`,
  158 |         exact: true,
  159 |       });
  160 |       await expect
  161 |         .poll(() =>
  162 |           graphic.evaluate((element) => element.getBoundingClientRect().height),
  163 |         )
  164 |         .toBeGreaterThan(initialHeight + 390);
  165 |     }
  166 |     await page.screenshot({
  167 |       path: `output/chart-space-${definition.type.toLowerCase()}.png`,
  168 |       fullPage: true,
  169 |     });
  170 |     await page.setViewportSize({ width: 1440, height: 1000 });
  171 |     await expect.poll(plotHeight).toBeLessThan(initialHeight + 2);
  172 |     await page.setViewportSize({ width: 390, height: 844 });
  173 |     await expect
  174 |       .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
  175 |       .toBeLessThanOrEqual(390);
  176 |     await expect(plot).toBeVisible();
  177 |     await page.setViewportSize({ width: 1440, height: 1000 });
  178 |     await page.getByRole("button", { name: "Edit", exact: true }).click();
  179 |     await page
  180 |       .getByRole("combobox")
  181 |       .filter({ hasText: "Select breakdown field" })
  182 |       .click();
  183 |     await page.getByPlaceholder("Search field...").fill("device");
  184 |     await page.getByRole("option").filter({ hasText: "device" }).click();
  185 |     const groups = page.getByTestId("breakdown-group");
  186 |     await expect(groups).toHaveCount(0);
  187 |     await expect(plot).toHaveCount(1);
  188 |     const chart = page.getByRole("img", {
  189 |       name: `Grouped ${definition.type}`,
  190 |       exact: true,
  191 |     });
  192 |     await expect(chart).toBeVisible();
  193 |     for (const label of ["desktop", "mobile", "(missing)"]) {
  194 |       if (definition.type === "Trend") {
  195 |         await expect(
  196 |           page
  197 |             .getByTestId("chart-series")
  198 |             .filter({ hasText: `Events · ${label}` }),
  199 |         ).toBeVisible();
  200 |         await expect(
  201 |           page
  202 |             .getByTestId("chart-series")
  203 |             .filter({ hasText: `Purchases · ${label}` }),
  204 |         ).toBeVisible();
  205 |       } else if (definition.type === "Path") {
  206 |         await expect(
  207 |           page.getByTestId("chart-series").getByText(label, { exact: true }),
  208 |         ).toBeVisible();
  209 |         await expect(page.getByText("purchase", { exact: true })).toHaveCount(
  210 |           3,
  211 |         );
  212 |       } else {
  213 |         const row = page.getByRole("row").filter({ hasText: label });
  214 |         if (definition.type === "Value") {
  215 |           await expect(row.getByRole("cell").nth(1)).toHaveText("2");
  216 |           await expect(row.getByRole("cell").nth(2)).toHaveText("0");
  217 |         } else if (definition.type === "Funnel") {
  218 |           await expect(
  219 |             row.filter({ hasText: "purchase" }).getByRole("cell").nth(1),
  220 |           ).toHaveText("1");
  221 |           await expect(row.filter({ hasText: "purchase" })).toContainText(
  222 |             "100.0%",
  223 |           );
  224 |         } else if (definition.type === "Breakdown") {
  225 |           await expect(
  226 |             row.filter({ hasText: "signup" }).getByRole("cell").nth(1),
  227 |           ).toHaveText("1");
  228 |         } else {
  229 |           await expect(row).toContainText("100%");
  230 |           await expect(row.getByRole("cell").nth(1)).toHaveText("1");
  231 |         }
  232 |       }
  233 |     }
  234 |     if (definition.type === "Trend") {
  235 |       await expect(page.getByTestId("chart-series")).toHaveCount(6);
  236 |       await expectSideBySideBars(chart, 9);
  237 |       await chart.hover({ position: { x: 400, y: 100 } });
  238 |       await expect(page.getByRole("status")).toHaveAccessibleName(
  239 |         /Events · desktop: 1/,
```