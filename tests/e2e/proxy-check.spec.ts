import { test, expect, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import { loginAsAdmin } from "../support/auth";
import { workerOrigin } from "../support/server";

const proxyCheck = z.object({ status: z.string(), clientIp: z.string() });
const guide = (page: Page) =>
  page.getByRole("dialog", { name: /proxy|forward the visitor/i });

// TRUSTED_PROXIES is read at startup, so the flow restarts a dedicated service
// on one data directory, the way an operator would after editing the config.
async function startServer(dataDir: string, trustedProxies?: string) {
  const origin = workerOrigin();
  let log = "";
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    PORT: new URL(origin).port,
    APP_ORIGIN: origin,
    DATA_DIR: dataDir,
  };
  delete env.TRUSTED_PROXIES;
  if (trustedProxies) env.TRUSTED_PROXIES = trustedProxies;
  const server = spawn("bun", ["server.ts"], {
    cwd: resolve("apps/web"),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (data: Buffer) => (log += data.toString()));
  server.stderr.on("data", (data: Buffer) => (log += data.toString()));
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(origin + "/api/health")).status;
        } catch {
          return 0;
        }
      },
      { timeout: 20000, message: log },
    )
    .toBe(200);
  return server;
}

async function stopServer(server: ChildProcess) {
  if (server.exitCode !== null || server.signalCode !== null) return;
  const exited = once(server, "exit");
  server.kill("SIGKILL");
  await exited;
}

test("the proxy setup guide explains the fix and clears after the operator trusts the proxy", async ({
  browser,
}) => {
  const origin = workerOrigin();
  const directory = mkdtempSync(join(tmpdir(), "quacklytics-proxy-check-"));
  const dataDir = join(directory, "data");
  // Test traffic arrives over loopback; the header makes it look proxied.
  const context = await browser.newContext({
    baseURL: origin,
    extraHTTPHeaders: { "X-Forwarded-For": "203.0.113.7" },
  });
  const page = await context.newPage();
  let server = await startServer(dataDir);
  try {
    // Visitors who are not signed in neither see the guide nor the details.
    expect((await page.request.get("/api/proxy-check")).status()).toBe(401);
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(guide(page)).toBeHidden();

    await loginAsAdmin(page, origin);
    await page.goto("/projects");
    await expect(guide(page)).toBeVisible();
    await expect(guide(page)).toContainText(
      "Requests reach Quacklytics through an untrusted proxy",
    );
    await expect(guide(page)).toContainText("127.0.0.1");
    await expect(guide(page)).toContainText("TRUSTED_PROXIES=loopback");
    await guide(page).getByRole("tab", { name: "Docker Compose" }).click();
    await expect(guide(page)).toContainText('TRUSTED_PROXIES: "loopback"');

    await stopServer(server);
    server = await startServer(dataDir, "loopback");
    await guide(page).getByRole("button", { name: "Retest" }).click();
    await expect(guide(page)).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Projects", exact: true }),
    ).toBeVisible();
    const result = proxyCheck.parse(
      await (await page.request.get("/api/proxy-check")).json(),
    );
    expect(result).toMatchObject({ status: "ok", clientIp: "203.0.113.7" });

    // A trusted proxy that stops forwarding the header is reported too, and
    // the operator can set the guide aside for the rest of the session.
    await context.setExtraHTTPHeaders({});
    await page.reload();
    await expect(guide(page)).toContainText(
      "Your proxy does not forward the visitor's address",
    );
    await expect(guide(page)).toContainText(
      "proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
    );
    await guide(page)
      .getByRole("button", { name: "Ignore for this session" })
      .click();
    await expect(guide(page)).toBeHidden();
    const checked = page.waitForResponse("**/api/proxy-check");
    await page.reload();
    expect((await checked).ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", { name: "Projects", exact: true }),
    ).toBeVisible();
    await expect(guide(page)).toBeHidden();
  } finally {
    await context.close();
    await stopServer(server);
    rmSync(directory, { recursive: true, force: true });
  }
});

test("direct connections pass the check without showing the guide", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing baseURL");
  await loginAsAdmin(page, baseURL);
  const result = proxyCheck.parse(
    await (await page.request.get("/api/proxy-check")).json(),
  );
  expect(result).toMatchObject({ status: "direct", clientIp: "127.0.0.1" });
  const checked = page.waitForResponse("**/api/proxy-check");
  await page.goto("/projects");
  expect((await checked).ok()).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
});
