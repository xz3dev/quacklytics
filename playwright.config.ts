import { existsSync, mkdtempSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { defineConfig } from "@playwright/test";
if (existsSync("apps/web/.env.local")) loadEnvFile("apps/web/.env.local");
// Test servers, including spawned ones, must not download the GeoIP database.
process.env.GEOIP ??= "off";
export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "**/production-image.spec.ts",
  globalSetup: "./tests/support/global-setup.ts",
  // Files run in parallel; tests within a file stay ordered on one worker.
  // dev/cors.json allows spawned-server origins for up to 16 workers.
  fullyParallel: false,
  workers: process.env.CI
    ? 2
    : Math.min(16, Math.max(1, Math.floor(availableParallelism() / 2))),
  timeout: 90000,
  expect: { timeout: 20000 },
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // CI shards emit blobs that a follow-up job merges into one HTML report.
  reporter: process.env.CI
    ? [["list"], ["blob"]]
    : [["list"], ["html", { open: "never" }]],
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
