import { test, expect, request } from "@playwright/test";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { loginAsAdmin } from "../support/auth";

const eventRows = z.array(
  z.object({
    id: z.string(),
    eventType: z.string(),
    sessionId: z.string().nullable(),
    personId: z.string().nullable(),
    properties: z.record(z.string(), z.json()),
  }),
);

// Salt rotation depends on the service's clock, so this runs a dedicated
// service with the deterministic E2E clock rather than the shared one.
test("declined visitors get cookieless daily identities whose salts rotate and expire on the service", async () => {
  const directory = mkdtempSync(join(tmpdir(), "quacklytics-anonymous-"));
  const clock = join(directory, "clock");
  const setClock = (time: string) => writeFileSync(clock, time);
  setClock("2026-10-06T23:50:00.000Z");
  const origin = "http://127.0.0.1:4178";
  let log = "";
  const server = spawn(
    "bun",
    ["--preload", resolve("tests/fixtures/analytics-clock.ts"), "server.ts"],
    {
      cwd: resolve("apps/web"),
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: "4178",
        APP_ORIGIN: origin,
        DATA_DIR: join(directory, "data"),
        ANALYTICS_TEST_CLOCK: clock,
        // Test requests arrive over loopback, standing in for a reverse proxy.
        TRUSTED_PROXIES: "loopback",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
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
        { timeout: 20000, message: log },
      )
      .toBe(200);
    expect(
      (
        await api.post("/api/auth/sign-up/email", {
          data: {
            email: "anonymous@example.com",
            password: "Anonymous-password-123",
            name: "Anonymous",
          },
        })
      ).ok(),
      log,
    ).toBeTruthy();
    const project = z
      .object({ id: z.string() })
      .parse(
        await (
          await api.post("/api/projects", { data: { name: "Anonymous" } })
        ).json(),
      );
    expect(
      (
        await api.post(`/api/${project.id}/settings`, {
          data: [{ key: "cors_origins", value: origin }],
        })
      ).ok(),
    ).toBeTruthy();
    const key = z
      .array(z.object({ key: z.string() }))
      .parse(await (await api.post(`/api/${project.id}/apikeys`)).json())
      .at(-1)?.key;
    if (!key) throw new Error("Missing key");

    const operation = (eventType: string, timestamp: string) => ({
      kind: "event",
      id: crypto.randomUUID(),
      timestamp,
      eventType,
      properties: {},
      context: { sdk: { name: "@quacklytics/client", version: "0.2.0" } },
      anonymous: true,
    });
    const send = async (
      userAgent: string,
      operations: unknown[],
      requestId = crypto.randomUUID(),
      forwardedFor?: string,
    ) =>
      api.post("/api/ingest", {
        headers: {
          "X-API-KEY": key,
          "User-Agent": userAgent,
          ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
        },
        data: { protocolVersion: 1, requestId, operations },
      });
    const capture = async (
      userAgent: string,
      eventType: string,
      time: string,
      forwardedFor?: string,
    ) => {
      setClock(time);
      const response = await send(
        userAgent,
        [operation(eventType, time)],
        undefined,
        forwardedFor,
      );
      expect(response.ok(), await response.text()).toBeTruthy();
    };
    const rows = async () =>
      eventRows.parse(
        await (await api.get(`/api/${project.id}/events`)).json(),
      );
    const row = async (eventType: string) => {
      const found = (await rows()).find((item) => item.eventType === eventType);
      if (!found) throw new Error(`Missing ${eventType}`);
      return found;
    };
    const salts = async () =>
      z
        .array(z.object({ day: z.string() }))
        .parse(
          JSON.parse(
            (
              await promisify(execFile)("bun", [
                "-e",
                'import { Database } from "bun:sqlite"; const db = new Database(Bun.argv.at(-1), { readonly: true }); console.log(JSON.stringify(db.query("SELECT day FROM anonymous_salts ORDER BY day").all()));',
                join(directory, "data", "app.sqlite"),
              ])
            ).stdout,
          ),
        );

    await capture("Browser/1", "first", "2026-10-06T23:50:00.000Z");
    await capture("Browser/1", "second", "2026-10-06T23:55:00.000Z");
    await capture("Browser/2", "other_browser", "2026-10-06T23:56:00.000Z");
    const first = await row("first");
    expect(first.personId).toMatch(/^anonymous:daily:[0-9a-f]{64}$/);
    expect(await row("second")).toMatchObject({
      personId: first.personId,
      sessionId: first.sessionId,
    });
    expect((await row("other_browser")).personId).not.toBe(first.personId);

    // Just after midnight the visit continues under yesterday's identity.
    await capture("Browser/1", "after_midnight", "2026-10-07T00:05:00.000Z");
    expect(await row("after_midnight")).toMatchObject({
      personId: first.personId,
      sessionId: first.sessionId,
    });
    // After 30 idle minutes, today's salt yields an unlinkable visitor.
    await capture("Browser/1", "next_visit", "2026-10-07T00:50:00.000Z");
    const nextVisit = await row("next_visit");
    expect(nextVisit.personId).toMatch(/^anonymous:daily:/);
    expect(nextVisit.personId).not.toBe(first.personId);
    expect(nextVisit.sessionId).not.toBe(first.sessionId);

    // Retrying an event after rotation is a duplicate, not a conflicting rewrite.
    const retried = operation("retried", "2026-10-07T00:51:00.000Z");
    expect((await send("Browser/1", [retried])).ok()).toBeTruthy();
    setClock("2026-10-08T12:00:00.000Z");
    const retry = await send("Browser/1", [retried]);
    expect(retry.ok(), await retry.text()).toBeTruthy();
    expect(await retry.json()).toMatchObject({ committed: 0, duplicates: 1 });

    // Salts older than yesterday are deleted, so earlier IDs cannot be recomputed.
    expect(await salts()).toEqual([
      { day: "2026-10-06" },
      { day: "2026-10-07" },
    ]);
    await capture("Browser/1", "later", "2026-10-09T12:00:00.000Z");
    expect(await salts()).toEqual([{ day: "2026-10-09" }]);

    const identified = await send("Browser/1", [
      { ...operation("forged", "2026-10-09T12:00:00.000Z"), anonymousId: "x" },
    ]);
    expect(identified.status()).toBe(400);

    // Behind a trusted proxy, visitors are told apart by their forwarded address.
    const at = "2026-10-09T12:05:00.000Z";
    await capture("Shared/1", "proxied_a", at, "203.0.113.5");
    await capture("Shared/1", "proxied_a_again", at, "203.0.113.5");
    await capture("Shared/1", "proxied_b", at, "203.0.113.6");
    // A client-supplied entry left of the proxy's own is not trusted.
    await capture("Shared/1", "spoofed", at, "198.51.100.9, 203.0.113.5");
    const proxied = (await row("proxied_a")).personId;
    expect((await row("proxied_a_again")).personId).toBe(proxied);
    expect((await row("spoofed")).personId).toBe(proxied);
    expect((await row("proxied_b")).personId).not.toBe(proxied);
    expect(JSON.stringify(await rows())).not.toMatch(
      /Browser\/|Shared\/|127\.0\.0\.1|203\.0\.113|198\.51\.100/,
    );
  } finally {
    await api.dispose();
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGKILL");
      await exited;
    }
    rmSync(directory, { recursive: true, force: true });
  }
});

test("without trusted proxies, forwarded addresses cannot split or merge anonymous visitors", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing service origin");
  await loginAsAdmin(page, baseURL);
  const project = z.object({ id: z.string() }).parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Untrusted proxy" },
      })
    ).json(),
  );
  const key = z
    .array(z.object({ key: z.string() }))
    .parse(await (await page.request.post(`/api/${project.id}/apikeys`)).json())
    .at(-1)?.key;
  if (!key) throw new Error("Missing key");
  for (const [eventType, forwardedFor] of [
    ["first", "203.0.113.5"],
    ["second", "203.0.113.6"],
  ] as const) {
    const response = await page.request.post("/api/ingest", {
      headers: {
        "X-API-KEY": key,
        "User-Agent": "Untrusted/1",
        "X-Forwarded-For": forwardedFor,
      },
      data: {
        protocolVersion: 1,
        requestId: crypto.randomUUID(),
        operations: [
          {
            kind: "event",
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            eventType,
            properties: {},
            context: { sdk: { name: "@quacklytics/client", version: "0.2.0" } },
            anonymous: true,
          },
        ],
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  const rows = eventRows.parse(
    await (await page.request.get(`/api/${project.id}/events`)).json(),
  );
  expect(rows).toHaveLength(2);
  expect(rows[0]?.personId).toMatch(/^anonymous:daily:/);
  expect(rows[1]?.personId).toBe(rows[0]?.personId);
});
