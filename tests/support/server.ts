import { expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/** Runs a production server with its own data directory and environment. */
export async function withServer<T>(
  port: number,
  env: Record<string, string>,
  run: (origin: string, directory: string) => Promise<T>,
) {
  const directory = mkdtempSync(join(tmpdir(), "quacklytics-server-"));
  const origin = `http://127.0.0.1:${port}`;
  let log = "";
  const server = spawn("bun", ["server.ts"], {
    cwd: resolve("apps/web"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      APP_ORIGIN: origin,
      DATA_DIR: join(directory, "data"),
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (data: Buffer) => {
    log += data.toString();
  });
  server.stderr.on("data", (data: Buffer) => {
    log += data.toString();
  });
  try {
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
    return await run(origin, directory);
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGKILL");
      await exited;
    }
    rmSync(directory, { recursive: true, force: true });
  }
}
