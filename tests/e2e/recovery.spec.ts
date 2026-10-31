import { test, expect, request } from "@playwright/test";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { z } from "zod";
import {
  insight,
  dashboard as dashboardSchema,
} from "../../packages/contracts/src/index";
import { workerOrigin } from "../support/server";

test("failed S3 exports retry after SIGKILL while events, credentials and dashboards persist", async ({
  page,
}) => {
  const directory = mkdtempSync(join(tmpdir(), "quacklytics-recovery-"));
  const origin = workerOrigin();
  let process: ChildProcess | undefined;
  let log = "";
  let storageSecret = "deliberately-invalid-test-secret";
  async function start() {
    process = spawn("bun", ["server.ts"], {
      cwd: resolve("apps/web"),
      env: {
        ...globalThis.process.env,
        NODE_ENV: "production",
        PORT: new URL(origin).port,
        APP_ORIGIN: origin,
        DATA_DIR: directory,
        S3_SECRET_ACCESS_KEY: storageSecret,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    process.stdout?.on("data", (chunk: Buffer) => {
      log += chunk.toString();
    });
    process.stderr?.on("data", (chunk: Buffer) => {
      log += chunk.toString();
    });
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(origin + "/api/health")).status;
          } catch {
            return 0;
          }
        },
        { message: log, timeout: 20000 },
      )
      .toBe(200);
  }
  async function kill() {
    if (process && process.exitCode === null) {
      const exit = once(process, "exit");
      process.kill("SIGKILL");
      await exit;
    }
    process = undefined;
  }
  const api = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  try {
    await start();
    const register = await api.post("/api/auth/sign-up/email", {
      data: {
        name: "Recovery",
        email: "recovery@example.com",
        password: "Recovery-password-123",
      },
    });
    expect(register.ok(), await register.text()).toBeTruthy();
    const project = z.object({ id: z.string() }).parse(
      await (
        await api.post("/api/projects", {
          data: { name: "Recovered project" },
        })
      ).json(),
    );
    await api.post(`/api/${project.id}/settings`, {
      data: [{ key: "cors_origins", value: origin }],
    });
    const keys = z
      .array(z.object({ key: z.string() }))
      .parse(await (await api.post(`/api/${project.id}/apikeys`)).json());
    const key = keys.at(-1)?.key;
    if (!key) throw new Error("Missing key");
    const firstSeen = Date.now() - 86400000;
    const batches = Array.from({ length: 10 }, (_, batch) => ({
      requestId: crypto.randomUUID(),
      events: Array.from({ length: 20 }, (_, index) => ({
        id: crypto.randomUUID(),
        eventType: "durable",
        timestamp: new Date(
          firstSeen + Math.floor((batch * 20 + index) / 2),
        ).toISOString(),
        sessionId: "durable-session",
        ...(batch >= 5 ? { personId: "durable-person" } : {}),
        personProperties: {
          sequence: batch * 20 + index,
          plan: batch >= 5 ? "pro" : "free",
          ...(batch < 5 ? { legacy: true } : {}),
        },
        properties: { amount: 1 },
      })),
    }));
    const replies = await Promise.all(
      batches.map((data) =>
        api.post("/api/ingest", { headers: { "X-API-KEY": key }, data }),
      ),
    );
    for (const reply of replies)
      expect(await reply.json()).toMatchObject({ committed: 20 });
    const members = insight
      .array()
      .parse(await (await api.get(`/api/${project.id}/insights`)).json())
      .reverse();
    const dashboard = z.object({ id: z.number() }).parse(
      await (
        await api.post(`/api/${project.id}/dashboards`, {
          data: {
            name: "Durable dashboard",
            favorite: true,
            insights: members.map(({ id }) => ({ id })),
          },
        })
      ).json(),
    );
    const failedExport = await api.post(
      `/api/${project.id}/events/catalog/gen`,
    );
    expect(failedExport.status()).toBe(500);
    expect(
      await (await api.get(`/api/${project.id}/events/status`)).json(),
    ).toMatchObject({
      pending: true,
      exportedRevision: 0,
      exportError: "Event export failed. Retrying automatically.",
    });
    await page.context().addCookies((await api.storageState()).cookies);
    await page.goto(`${origin}/app/${project.id}/events`);
    await page.getByRole("button", { name: /^Analytics data:/ }).click();
    await expect(page.getByLabel("Analytics freshness")).toContainText(
      "Event export failed. Retrying automatically.",
    );
    await page.goto("about:blank");
    expect(
      z
        .array(z.unknown())
        .parse(await (await api.get(`/api/${project.id}/events`)).json()),
    ).toHaveLength(200);
    expect(existsSync(join(directory, "projects", project.id, "exports"))).toBe(
      false,
    );
    storageSecret = z
      .string()
      .min(1)
      .parse(globalThis.process.env.S3_SECRET_ACCESS_KEY);
    // A separate interrupted import must survive restart without leaving exports paused.
    const deferredProject = z.object({ id: z.string() }).parse(
      await (
        await api.post("/api/projects", {
          data: { name: "Interrupted import" },
        })
      ).json(),
    );
    await api.post(`/api/${deferredProject.id}/settings`, {
      data: [{ key: "cors_origins", value: origin }],
    });
    const deferredKeys = z
      .array(z.object({ key: z.string() }))
      .parse(
        await (await api.post(`/api/${deferredProject.id}/apikeys`)).json(),
      );
    const deferredKey = deferredKeys.at(-1)?.key;
    if (!deferredKey) throw new Error("Missing interrupted import key");
    const deferredBatch = {
      requestId: crypto.randomUUID(),
      deferExport: true,
      events: [
        {
          id: crypto.randomUUID(),
          eventType: "interrupted",
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        },
      ],
    };
    const deferredHeaders = { "X-API-KEY": deferredKey };
    expect(
      await (
        await api.post("/api/ingest", {
          headers: deferredHeaders,
          data: deferredBatch,
        })
      ).json(),
    ).toMatchObject({ committed: 1 });
    expect(
      await (await api.get(`/api/${deferredProject.id}/events/catalog`)).json(),
    ).toEqual([]);

    const original = batches[0]?.events[0];
    if (!original) throw new Error("Missing original event");
    expect(
      (
        await api.post("/api/ingest", {
          headers: { "X-API-KEY": key },
          data: {
            requestId: crypto.randomUUID(),
            events: [
              {
                id: crypto.randomUUID(),
                eventType: "rollback",
                timestamp: new Date(firstSeen - 1000).toISOString(),
                personId: "durable-person",
                personProperties: { poison: true },
              },
              { ...original, eventType: "conflict" },
            ],
          },
        })
      ).status(),
    ).toBe(409);
    // Versioned SDK control operations and actor links survive the same crash.
    const sdkProject = z
      .object({ id: z.string() })
      .parse(
        await (
          await api.post("/api/projects", { data: { name: "SDK recovery" } })
        ).json(),
      );
    await api.post(`/api/${sdkProject.id}/settings`, {
      data: [{ key: "cors_origins", value: origin }],
    });
    const sdkKeys = z
      .array(z.object({ key: z.string() }))
      .parse(await (await api.post(`/api/${sdkProject.id}/apikeys`)).json());
    const sdkKey = sdkKeys.at(-1)?.key;
    if (!sdkKey) throw new Error("Missing SDK recovery key");
    const anonymousId = crypto.randomUUID();
    const sdkBatch = {
      protocolVersion: 1,
      requestId: crypto.randomUUID(),
      operations: [
        {
          kind: "event",
          id: crypto.randomUUID(),
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          anonymousId,
          eventType: "sdk_durable",
          properties: { durable: true },
          context: { sdk: { name: "@quacklytics/client", version: "0.2.0" } },
        },
        {
          kind: "identify",
          id: crypto.randomUUID(),
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          anonymousId,
          userId: "durable-sdk-user",
          traits: { plan: "pro" },
        },
      ],
    };
    expect(
      await (
        await api.post("/api/ingest", {
          headers: { "X-API-KEY": sdkKey },
          data: sdkBatch,
        })
      ).json(),
    ).toMatchObject({ committed: 2 });
    const cookies = await api.storageState();
    await kill();
    // Person properties have no read API yet. Inspect durable state after SIGKILL
    // to cover the otherwise inaccessible merge result, tie-break and rollback.
    const persisted = await promisify(execFile)("bun", [
      "-e",
      `
      import { Database } from "bun:sqlite";
      import { z } from "zod";
import { insight, dashboard as dashboardSchema } from "../../packages/contracts/src/index";
      const db = new Database(z.string().parse(Bun.argv.at(-1)), { readonly: true });
      console.log(JSON.stringify(db.query("SELECT first_seen,properties FROM persons WHERE id=?").get("durable-person")));
      db.close();
    `,
      join(directory, "projects", project.id, "project.sqlite"),
    ]);
    const person = z
      .object({ first_seen: z.number(), properties: z.string() })
      .parse(JSON.parse(persisted.stdout));
    const latest = batches
      .flatMap((batch) => batch.events)
      .sort(
        (a, b) =>
          a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id),
      )
      .at(-1);
    if (!latest) throw new Error("Missing latest person update");
    expect(person.first_seen).toBe(firstSeen);
    expect(JSON.parse(person.properties)).toEqual({
      sequence: latest.personProperties.sequence,
      plan: "pro",
      legacy: true,
    });
    await start();
    expect(
      await (
        await api.post("/api/ingest", {
          headers: { "X-API-KEY": sdkKey },
          data: sdkBatch,
        })
      ).json(),
    ).toMatchObject({ committed: 2 });
    const sdkRows = z
      .array(
        z.object({
          eventType: z.string(),
          personId: z.string(),
          properties: z.record(z.string(), z.json()),
        }),
      )
      .parse(await (await api.get(`/api/${sdkProject.id}/events`)).json());
    expect(sdkRows).toHaveLength(1);
    expect(sdkRows[0]).toMatchObject({
      eventType: "sdk_durable",
      personId: "user:durable-sdk-user",
      properties: { durable: true },
    });
    expect(
      (
        await api.post("/api/ingest", {
          headers: { "X-API-KEY": sdkKey },
          data: {
            protocolVersion: 1,
            requestId: crypto.randomUUID(),
            operations: [
              {
                kind: "identify",
                id: crypto.randomUUID(),
                timestamp: new Date(Date.now() - 86400000).toISOString(),
                anonymousId,
                userId: "conflicting-user",
                traits: {},
              },
            ],
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (await api.post(`/api/${sdkProject.id}/events/catalog/gen`)).ok(),
    ).toBeTruthy();
    expect(
      z
        .array(z.object({ eventCount: z.number() }))
        .parse(
          await (await api.get(`/api/${sdkProject.id}/events/catalog`)).json(),
        )
        .reduce((sum, file) => sum + file.eventCount, 0),
    ).toBe(1);
    expect(
      await (
        await api.post("/api/ingest", {
          headers: deferredHeaders,
          data: deferredBatch,
        })
      ).json(),
    ).toMatchObject({ committed: 1 });
    expect(
      (
        await api.post("/api/ingest", {
          headers: deferredHeaders,
          data: { ...deferredBatch, deferExport: false },
        })
      ).status(),
    ).toBe(409);
    await expect
      .poll(
        async () => {
          const files = z
            .array(z.object({ eventCount: z.number() }))
            .parse(
              await (
                await api.get(`/api/${deferredProject.id}/events/catalog`)
              ).json(),
            );
          return files.reduce((sum, file) => sum + file.eventCount, 0);
        },
        { timeout: 45000 },
      )
      .toBe(1);
    expect((await api.get("/api/me")).ok()).toBeTruthy();
    expect(
      await (
        await api.get(`/api/${project.id}/dashboards/${dashboard.id}`)
      ).json(),
    ).toMatchObject({ name: "Durable dashboard", favorite: true });
    expect(
      dashboardSchema.parse(
        await (
          await api.get(`/api/${project.id}/dashboards/${dashboard.id}`)
        ).json(),
      ).insights,
    ).toEqual(members);
    expect(
      z
        .array(z.unknown())
        .parse(await (await api.get(`/api/${project.id}/events`)).json()),
    ).toHaveLength(200);
    for (const data of batches) {
      const retry = await api.post("/api/ingest", {
        headers: { "X-API-KEY": key },
        data,
      });
      expect(await retry.json()).toMatchObject({ committed: 20 });
    }
    expect(
      z
        .array(z.unknown())
        .parse(await (await api.get(`/api/${project.id}/events`)).json()),
    ).toHaveLength(200);
    const catalogSchema = z.array(
      z.object({
        name: z.string(),
        url: z.string(),
        checksum: z.string(),
        eventCount: z.number(),
      }),
    );
    const exported = catalogSchema.parse(
      await (await api.get(`/api/${project.id}/events/catalog`)).json(),
    );
    expect(exported).toHaveLength(1);
    expect(exported[0]?.eventCount).toBe(200);
    const snapshot = exported[0];
    if (!snapshot) throw new Error("Missing exported snapshot");
    const parquet = await api.get(snapshot.url);
    expect(parquet.ok()).toBeTruthy();
    expect((await parquet.body()).subarray(0, 4).toString()).toBe("PAR1");
    await kill();
    await start();
    const restarted = catalogSchema.parse(
      await (await api.get(`/api/${project.id}/events/catalog`)).json(),
    );
    expect(restarted.map((file) => file.checksum)).toEqual(
      exported.map((file) => file.checksum),
    );
    expect(existsSync(join(directory, "projects", project.id, "exports"))).toBe(
      false,
    );
    await page.context().addCookies(cookies.cookies);
    await page.goto(`${origin}/app/${project.id}/queries`);
    await page
      .locator(".cm-content")
      .fill("SELECT count(*) AS committed_events FROM events");
    await page.getByRole("button", { name: "Execute", exact: true }).click();
    await expect(
      page.getByRole("cell", { name: "200", exact: true }),
    ).toBeVisible();
  } finally {
    await kill();
    await api.dispose();
    rmSync(directory, { recursive: true, force: true });
  }
});
