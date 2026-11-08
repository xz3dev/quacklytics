// Captures the product screenshots used by the landing page (apps/home) from a
// running instance that holds the Orbit demo project created by
// `bun run seed:dev --email …`. See scripts/landing/README.md.
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Page } from "@playwright/test";
import { z } from "zod";

const { values } = parseArgs({
  options: {
    url: { type: "string", default: "http://127.0.0.1:3000" },
    project: { type: "string" },
    out: { type: "string", default: "apps/home/src/assets/screenshots" },
  },
  strict: true,
});
const origin = new URL(values.url).origin;
const email = process.env.QUACKLYTICS_EMAIL;
const password = process.env.QUACKLYTICS_PASSWORD;
if (!values.project || !email || !password)
  throw new Error(
    "Usage: QUACKLYTICS_EMAIL=… QUACKLYTICS_PASSWORD=… bun scripts/landing/capture-screenshots.ts --project <id> [--url …]",
  );
const project = values.project;
const out = resolve(values.out);
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await context.newPage();
const signIn = await page.request.post(`${origin}/api/auth/sign-in/email`, {
  headers: { Origin: origin },
  data: { email, password },
});
if (!signIn.ok()) throw new Error(`Sign-in failed: ${signIn.status()}`);

const named = z.array(z.object({ id: z.number(), name: z.string() }));
async function idOf(kind: "insights" | "dashboards", name: string) {
  const response = await page.request.get(`${origin}/api/${project}/${kind}`);
  const match = named
    .parse(await response.json())
    .find((item) => item.name === name);
  if (!match)
    throw new Error(`No ${kind} named "${name}" in project ${project}`);
  return match.id;
}

/** Opens a page and waits until DuckDB has answered every chart query. */
async function open(target: Page, path: string) {
  await target.goto(`${origin}/app/${project}${path}`);
  await target.waitForLoadState("networkidle");
  await target.waitForFunction(
    () => !document.querySelector(".animate-spin, .animate-pulse"),
    undefined,
    { timeout: 60_000 },
  );
  // Let chart transitions settle.
  await target.waitForTimeout(1500);
}

const shot = (name: string) => ({ path: `${out}/${name}.png` });

const webDashboard = await idOf("dashboards", "Web Analytics Overview");
const playground = await idOf("dashboards", "Chart playground");

await open(page, `/dashboards/${webDashboard}`);
await page.screenshot(shot("web-analytics"));
for (const [name, insight] of [
  ["card-map", "Visitors by country"],
  ["card-referrers", "Referrers"],
] as const) {
  await page
    .getByTestId(`dashboard-insight-${await idOf("insights", insight)}`)
    .screenshot(shot(name));
}

await open(page, `/dashboards/${playground}`);
await page.screenshot(shot("product-analytics"));
for (const [name, insight] of [
  ["card-retention", "Workspace retention by signup cohort"],
  ["card-paths", "Journeys from the home page"],
  ["card-trend", "Daily pageviews and completed tasks"],
] as const) {
  const card = page.getByTestId(
    `dashboard-insight-${await idOf("insights", insight)}`,
  );
  await card.scrollIntoViewIfNeeded();
  await card.screenshot(shot(name));
}

await open(
  page,
  `/insights/${await idOf("insights", "Pricing to paid subscription")}/edit`,
);
await page.screenshot(shot("funnel"));

await open(page, "/queries");
await page.locator(".cm-content").click();
await page.keyboard.press("ControlOrMeta+A");
await page.keyboard.press("Backspace");
await page
  .locator(".cm-content")
  .fill(
    [
      "SELECT properties->>'$.$country' AS country,",
      "  count(DISTINCT person_id) AS visitors",
      "FROM events",
      "WHERE event_type = '$pageview'",
      "GROUP BY 1 ORDER BY 2 DESC LIMIT 8",
    ].join("\n"),
  );
await page.getByRole("button", { name: "Execute" }).click();
await page.getByRole("columnheader", { name: "visitors" }).waitFor();
await page
  .getByText("Query executed")
  .waitFor({ state: "hidden", timeout: 15_000 });
await page.mouse.move(0, 0);
await page.screenshot(shot("sql"));

await browser.close();
console.log(`Saved screenshots to ${out}`);
