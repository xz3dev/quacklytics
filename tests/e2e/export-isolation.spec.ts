import { test, expect, request } from "@playwright/test";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  analyticsStatus,
  analyticsSnapshot,
} from "../../packages/contracts/src/index";

test("stalled export leaves ingestion and catalog status responsive, then publishes both revisions", async () => {
  const storage = new URL(z.string().parse(process.env.S3_ENDPOINT));
  let release: (() => void) | undefined;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  let uploadWaiting = false;
  const proxy = createServer((incoming, outgoing) => {
    void (async () => {
      if (incoming.method === "PUT") {
        uploadWaiting = true;
        await hold;
      }
      if (outgoing.destroyed) return;
      const target = new URL(incoming.url ?? "/", storage);
      const forward = (
        target.protocol === "https:" ? httpsRequest : httpRequest
      )(
        target,
        {
          method: incoming.method,
          // Preserve the signed Host header when forwarding to Garage.
          headers: incoming.headers,
        },
        (response) => {
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
          response.pipe(outgoing);
        },
      );
      forward.on("error", () => {
        outgoing.writeHead(502);
        outgoing.end();
      });
      incoming.pipe(forward);
    })();
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  const { port } = z.object({ port: z.number() }).parse(proxy.address());
  const directory = mkdtempSync(
    join(tmpdir(), "quacklytics-export-isolation-"),
  );
  const origin = "http://127.0.0.1:4175";
  const server = spawn("bun", ["server.ts"], {
    cwd: resolve("apps/web"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "4175",
      APP_ORIGIN: origin,
      DATA_DIR: directory,
      S3_ENDPOINT: `http://127.0.0.1:${port}`,
      S3_PUBLIC_ENDPOINT: process.env.S3_PUBLIC_ENDPOINT ?? storage.href,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  server.stdout.on("data", (data: Buffer) => {
    log += data.toString();
  });
  server.stderr.on("data", (data: Buffer) => {
    log += data.toString();
  });
  const api = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
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
        { timeout: 20000 },
      )
      .toBe(200);
    const registration = await api.post("/api/auth/sign-up/email", {
      data: {
        email: "isolation@example.com",
        password: "Isolation-password-123",
        name: "Isolation",
      },
    });
    expect(registration.ok(), log).toBeTruthy();
    const project = z
      .object({ id: z.string() })
      .parse(
        await (
          await api.post("/api/projects", { data: { name: "Stalled export" } })
        ).json(),
      );
    expect(
      (
        await api.post(`/api/${project.id}/settings`, {
          data: [{ key: "cors_origins", value: origin }],
        })
      ).ok(),
    ).toBeTruthy();
    const keys = z
      .array(z.object({ key: z.string() }))
      .parse(await (await api.post(`/api/${project.id}/apikeys`)).json());
    const key = keys.at(-1)?.key;
    if (!key) throw new Error("Missing key");
    const ingest = async (eventType: string) => {
      const payload = {
        requestId: crypto.randomUUID(),
        events: [
          {
            id: crypto.randomUUID(),
            eventType,
            timestamp: new Date(Date.now() - 86400000).toISOString(),
          },
        ],
      };
      const response = await api.post("/api/ingest", {
        headers: { "X-API-KEY": key },
        data: payload,
        timeout: 5000,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return z.object({ revision: z.number() }).parse(await response.json());
    };
    await ingest("before-export");
    const exporting = api.post(`/api/${project.id}/events/catalog/gen`);
    const initial = analyticsStatus.parse(
      await (
        await api.get(`/api/${project.id}/events/status`, { timeout: 5000 })
      ).json(),
    );
    expect(initial.pending).toBe(true);
    await expect.poll(() => uploadWaiting).toBe(true);
    const committed = await ingest("during-export");
    expect((await api.get("/api/me", { timeout: 5000 })).ok()).toBeTruthy();
    const pending = analyticsStatus.parse(
      await (
        await api.get(`/api/${project.id}/events/status`, { timeout: 5000 })
      ).json(),
    );
    expect(pending).toMatchObject({
      committedRevision: committed.revision,
      exportedRevision: 0,
      pending: true,
      files: [],
    });
    expect(
      z
        .array(z.unknown())
        .parse(await (await api.get(`/api/${project.id}/events`)).json()),
    ).toHaveLength(2);
    const live = analyticsSnapshot.parse(
      await (await api.get(`/api/${project.id}/events/snapshot`)).json(),
    );
    expect(live.liveEvents).toHaveLength(2);
    expect(live.pending).toBe(false);
    release?.();
    expect((await exporting).ok()).toBeTruthy();
    expect(
      (await api.post(`/api/${project.id}/events/catalog/gen`)).ok(),
    ).toBeTruthy();
    await expect
      .poll(
        async () =>
          analyticsStatus.parse(
            await (await api.get(`/api/${project.id}/events/status`)).json(),
          ).exportedRevision,
        { timeout: 20000 },
      )
      .toBe(committed.revision);
    const published = analyticsStatus.parse(
      await (await api.get(`/api/${project.id}/events/status`)).json(),
    );
    expect(published.pending).toBe(false);
    expect(
      published.files.reduce((sum, file) => sum + file.eventCount, 0),
    ).toBe(2);
  } finally {
    release?.();
    await api.dispose();
    if (server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGKILL");
      await exited;
    }
    proxy.closeAllConnections();
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});
