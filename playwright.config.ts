import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { defineConfig } from "@playwright/test";
if (existsSync("apps/web/.env.local")) loadEnvFile("apps/web/.env.local");
// Test servers, including spawned ones, must not download the GeoIP database.
process.env.GEOIP ??= "off";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: {
    command:
      process.env.E2E_DEV === "1"
        ? "bun run --cwd apps/web dev --port 4173"
        : "bun run --cwd apps/web start",
    url: "http://127.0.0.1:4173/api/health",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PORT: "4173",
      DATA_DIR: mkdtempSync(join(tmpdir(), "quacklytics-e2e-")),
      APP_ORIGIN: "http://127.0.0.1:4173",
    },
  },
});
