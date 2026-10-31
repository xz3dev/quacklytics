import { request, type FullConfig } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { sharedSessionEnv, signInAsAdmin } from "./auth";

// Registers the admin once before workers start: parallel first logins would
// race to register it and trip the sign-in rate limit.
export default async function globalSetup(config: FullConfig) {
  const origin = z.string().parse(config.projects[0]?.use.baseURL);
  const api = await request.newContext();
  try {
    await signInAsAdmin(api, origin);
    const path = join(
      mkdtempSync(join(tmpdir(), "quacklytics-e2e-session-")),
      "session.json",
    );
    const { cookies } = await api.storageState();
    writeFileSync(path, JSON.stringify({ origin, cookies }));
    process.env[sharedSessionEnv] = path;
  } finally {
    await api.dispose();
  }
}
