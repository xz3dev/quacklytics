import { test, expect } from "@playwright/test";
import { z } from "zod";
import { loginAsAdmin } from "../support/auth";
import {
  project,
  apiKey,
  insight,
  insightInput,
  defaultInsights,
  filter,
} from "../../packages/contracts/src/index";

test("quoted property keys and typed IN filters agree across value, breakdown, and funnel results", async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL ?? "http://127.0.0.1:4173");
  const created = project.parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Shared filters" },
      })
    ).json(),
  );
  const key = apiKey
    .array()
    .parse(await (await page.request.post(`/api/${created.id}/apikeys`)).json())
    .at(-1);
  if (!key) throw new Error("Missing ingestion key");
  const plan = "plan.o'reilly";
  const amount = 'quota."limit"';
  const filters: z.infer<typeof filter>[] = [
    {
      field: { name: plan, type: "string", isProperty: true },
      operator: "IN",
      value: "pro,team",
    },
    {
      field: { name: amount, type: "number", isProperty: true },
      operator: ">",
      value: "10",
    },
    {
      field: { name: "active", type: "boolean", isProperty: true },
      operator: "=",
      value: "true",
    },
  ];
  const response = await page.request.post("/api/ingest", {
    headers: { "X-API-KEY": key.key },
    data: {
      requestId: crypto.randomUUID(),
      events: [
        { plan: "pro", quota: 20, active: true },
        { plan: "team", quota: 30, active: true },
        { plan: "free", quota: 50, active: true },
        { plan: "pro", quota: 5, active: true },
        { plan: "pro", quota: 50, active: false },
      ].flatMap((person, index) =>
        ["signup", "purchase"].map((eventType, step) => ({
          id: crypto.randomUUID(),
          eventType,
          personId: `person-${index}`,
          sessionId: `session-${index}`,
          timestamp: new Date(Date.now() - (3 - step) * 86400000).toISOString(),
          properties: {
            [plan]: person.plan,
            [amount]: person.quota,
            active: person.active,
          },
        })),
      ),
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const definitions: z.infer<typeof insightInput>[] = [
    {
      ...defaultInsights.Value,
      config: {
        value: {
          duration: "P7D",
          series: {
            query: {
              ...defaultInsights.Value.config.value.series.query,
              filters,
            },
          },
        },
      },
    },
    {
      ...defaultInsights.Breakdown,
      config: {
        breakdown: {
          ...defaultInsights.Breakdown.config.breakdown,
          dimension: { name: plan, type: "string", isProperty: true },
          filters,
        },
      },
    },
    {
      ...defaultInsights.Funnel,
      config: {
        funnel: {
          ...defaultInsights.Funnel.config.funnel,
          steps: ["signup", "purchase"].map((name, order) => ({
            id: name,
            name,
            order,
            query: {
              filters: [
                ...filters,
                {
                  field: { name: "event_type", type: "string" },
                  operator: "=",
                  value: name,
                },
              ],
            },
          })),
        },
      },
    },
  ];
  for (const definition of definitions) {
    const reply = await page.request.post(`/api/${created.id}/insights`, {
      data: { ...definition, name: `Filtered ${definition.type}` },
    });
    expect(reply.ok(), await reply.text()).toBeTruthy();
    const saved = insight.parse(await reply.json());
    await page.goto(`/app/${created.id}/insights/${saved.id}`);
    const verify = async () => {
      if (saved.type === "Value")
        await expect(
          page.getByLabel("Current value", { exact: true }),
        ).toHaveText("4");
      if (saved.type === "Breakdown") {
        await expect(page.locator("tbody tr")).toHaveCount(2);
        for (const label of ["pro", "team"])
          await expect(
            page
              .getByRole("row")
              .filter({
                has: page.getByRole("cell", { name: label, exact: true }),
              })
              .getByRole("cell")
              .nth(1),
          ).toHaveText("2");
      }
      if (saved.type === "Funnel") {
        const table = page.getByRole("table", { name: "Funnel results" });
        for (const name of ["signup", "purchase"])
          await expect(
            table
              .getByRole("row")
              .filter({ hasText: name })
              .getByRole("cell")
              .nth(1),
          ).toHaveText("2");
      }
      await expect(page.getByRole("alert")).toHaveCount(0);
    };
    await verify();
    await page.reload();
    await verify();
  }
});
