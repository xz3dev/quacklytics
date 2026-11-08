// Captures the first-run screens shown in the landing page's "Get started"
// section: admin registration, project creation and the setup guide. Needs a
// fresh instance without an administrator and the one-time setup link from its
// log. See scripts/landing/README.md.
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const { values } = parseArgs({
  options: {
    "setup-link": { type: "string" },
    out: { type: "string", default: "apps/home/src/assets/screenshots" },
  },
  strict: true,
});
if (!values["setup-link"])
  throw new Error("Pass --setup-link with the link from the server log");
const setupLink = new URL(values["setup-link"]);
const origin = setupLink.origin;
const out = resolve(values.out);
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const settle = async () => {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
};

await page.goto(setupLink.href);
await settle();
await page.screenshot({
  path: `${out}/setup-register.png`,
  clip: { x: 446, y: 186, width: 388, height: 458 },
});
await page.getByLabel("Email").fill("you@example.com");
const password = "Landing-page-password-42";
await page.getByLabel("Password", { exact: true }).fill(password);
await page.getByLabel("Confirm password").fill(password);
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL(/\/projects/);

await page.goto(`${origin}/projects/new`);
await settle();
await page.getByLabel("Project name").fill("My website");
await page.screenshot({
  path: `${out}/setup-project.png`,
  clip: { x: 348, y: 164, width: 584, height: 420 },
});
await page.getByRole("button", { name: "Create project" }).click();
await page.waitForURL(/\/setup$/);
await settle();
// Show the address a local Docker setup has instead of this instance's.
await page.evaluate((local) => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    node.textContent =
      node.textContent?.replaceAll(local, "http://localhost:3000") ?? "";
  }
}, origin);
await page.screenshot({
  path: `${out}/setup-guide.png`,
  clip: { x: 268, y: 104, width: 744, height: 384 },
});

await browser.close();
console.log(`Saved setup screenshots to ${out}`);
