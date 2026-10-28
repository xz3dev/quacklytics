import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "@playwright/test";

if (existsSync("apps/web/.env.local")) loadEnvFile("apps/web/.env.local");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "production-image.spec.ts",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 20000 },
  use: {
    baseURL: "http://127.0.0.1:4176",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
