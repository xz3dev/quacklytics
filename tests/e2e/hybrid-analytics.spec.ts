import { test, expect, request } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  analyticsSnapshot,
  catalogAccess,
} from "../../packages/contracts/src/index";
import { workerOrigin } from "../support/server";

test("daily monthly snapshots combine with compressed SQLite data across midnight, repairs, and restart", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const directory = mkdtempSync(join(tmpdir(), "quacklytics-hybrid-"));
  const clock = join(directory, "clock");
  writeFileSync(clock, "2026-10-06T12:00:00.000Z");
  const origin = workerOrigin();
  let log = "";
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      browserErrors.push(
        message.text().replace(/\?X-Amz-[^\s']+/g, "?[redacted]"),
      );
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const launch = () => {
    const child = spawn(
      "bun",
      ["--preload", resolve("tests/fixtures/analytics-clock.ts"), "server.ts"],
      {
        cwd: resolve("apps/web"),
        env: {
          ...process.env,
          NODE_ENV: "production",
          PORT: new URL(origin).port,
          APP_ORIGIN: origin,
          DATA_DIR: join(directory, "data"),
          ANALYTICS_TEST_CLOCK: clock,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout.on("data", (data: Buffer) => {
      log += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      log += data.toString();
    });
    return child;
  };
  let server = launch();
  const api = await request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const ready = async () => {
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
      .toBe(200)
      .catch((error: unknown) => {
        throw new Error(log + String(error));
      });
  };
  const stop = async () => {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGKILL");
      await exited;
    }
  };
  try {
    await ready();
    expect(
      (
        await api.post("/api/auth/sign-up/email", {
          data: {
            email: "hybrid@example.com",
            password: "Hybrid-password-123",
            name: "Hybrid",
          },
        })
      ).ok(),
      log,
    ).toBeTruthy();
    const project = z
      .object({ id: z.string() })
      .parse(
        await (
          await api.post("/api/projects", { data: { name: "Hybrid" } })
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
    const ingest = async (
      events: {
        id: string;
        eventType: string;
        timestamp: string;
        sessionId?: string;
        personId?: string;
        properties?: Record<string, unknown>;
      }[],
    ) => {
      const response = await api.post("/api/ingest", {
        headers: { "X-API-KEY": key },
        data: { requestId: crypto.randomUUID(), events },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
    };
    const event = (eventType: string, timestamp: string, fields = {}) => ({
      id: crypto.randomUUID(),
      eventType,
      timestamp,
      ...fields,
    });
    const catalog = async () =>
      catalogAccess
        .array()
        .parse(
          await (await api.get(`/api/${project.id}/events/catalog`)).json(),
        );
    const publish = async () => {
      const response = await api.post(`/api/${project.id}/events/catalog/gen`);
      expect(response.ok(), await response.text()).toBeTruthy();
      return catalogAccess.array().parse(await response.json());
    };
    const snapshot = async () => {
      const response = await api.get(`/api/${project.id}/events/snapshot`, {
        headers: { "Accept-Encoding": "gzip" },
      });
      expect(response.headers()["content-encoding"]).toBe("gzip");
      expect(response.headers()["cache-control"]).toContain("no-store");
      return analyticsSnapshot.parse(await response.json());
    };
    await ingest([
      event("prior-month", "2026-09-30T23:59:59.999Z"),
      event("yesterday", "2026-10-05T23:59:59.999Z", { sessionId: "linked" }),
      event("midnight", "2026-10-06T00:00:00.000Z", {
        properties: { nested: { plan: "pro" }, amount: 42 },
      }),
    ]);
    const before = await publish();
    expect(
      before.map((file) => [file.partition, file.end, file.eventCount]),
    ).toEqual([
      ["2026-09", "2026-10-01T00:00:00.000Z", 1],
      ["2026-10", "2026-10-06T00:00:00.000Z", 1],
    ]);
    expect((await snapshot()).liveEvents.map((row) => row.event_type)).toEqual([
      "midnight",
    ]);
    await page.context().addCookies((await api.storageState()).cookies);
    await page.goto(`${origin}/app/${project.id}/queries`);
    const query = async (sql: string, expected: string) => {
      await expect(page.getByRole("alert")).toHaveCount(0);
      await expect(page.locator(".cm-content"))
        .toBeVisible()
        .catch((error: unknown) => {
          throw new Error(String(error) + "\n" + browserErrors.join("\n"));
        });
      await page.locator(".cm-content").fill(sql);
      await page.getByRole("button", { name: "Execute", exact: true }).click();
      await expect(
        page.getByRole("cell", { name: expected, exact: true }),
      ).toBeVisible();
    };
    await query("SELECT count(*) AS total FROM events", "3");
    await query(
      "SELECT properties->'nested'->>'plan' AS plan FROM events WHERE event_type='midnight'",
      "pro",
    );
    await ingest([event("today", "2026-10-06T11:00:00.000Z")]);
    expect(await publish()).toEqual(
      expect.arrayContaining(
        before.map((file) =>
          expect.objectContaining({ name: file.name, checksum: file.checksum }),
        ),
      ),
    );
    expect((await catalog()).map((file) => file.name)).toEqual(
      before.map((file) => file.name),
    );
    await page.reload();
    await query("SELECT count(*) AS total FROM events", "4");

    // Before publication after midnight, yesterday is supplied by SQLite.
    writeFileSync(clock, "2026-10-07T00:00:01.000Z");
    await ingest([event("new-day", "2026-10-07T00:00:00.000Z")]);
    const rollover = await snapshot();
    expect(rollover.liveEvents.map((row) => row.event_type)).toEqual([
      "midnight",
      "today",
      "new-day",
    ]);
    expect(
      rollover.files.reduce((sum, file) => sum + file.eventCount, 0) +
        rollover.liveEvents.length,
    ).toBe(5);
    await page.reload();
    await query("SELECT count(DISTINCT id) AS total FROM events", "5");
    const after = await publish();
    expect(after.find((file) => file.partition === "2026-09")?.name).toBe(
      before[0]?.name,
    );
    expect(after.find((file) => file.partition === "2026-10")).toMatchObject({
      end: "2026-10-07T00:00:00.000Z",
      eventCount: 3,
    });
    expect((await snapshot()).liveEvents.map((row) => row.event_type)).toEqual([
      "new-day",
    ]);
    await page.reload();
    await query("SELECT count(*) AS total FROM events", "5");

    // Late historical data and identity edits replace stale monthly coverage.
    await ingest([
      event("late", "2026-10-02T00:00:00.000Z", {
        sessionId: "linked",
        personId: "person-linked",
      }),
    ]);
    const repair = await snapshot();
    expect(
      repair.files.reduce((sum, file) => sum + file.eventCount, 0) +
        repair.liveEvents.length,
    ).toBe(6);
    await page.reload();
    await query("SELECT count(*) AS total FROM events", "6");
    await query(
      "SELECT person_id FROM events WHERE event_type='yesterday'",
      "person-linked",
    );
    await publish();
    expect((await snapshot()).liveEvents).toHaveLength(1);
    await stop();
    server = launch();
    await ready();
    await page.reload();
    await query("SELECT count(*) AS total FROM events", "6");
    await query(
      "SELECT person_id FROM events WHERE event_type='yesterday'",
      "person-linked",
    );

    const other = z
      .object({ id: z.string() })
      .parse(
        await (
          await api.post("/api/projects", { data: { name: "Isolated" } })
        ).json(),
      );
    await page.goto(`${origin}/app/${other.id}/queries`);
    await query("SELECT count(*) AS total FROM events", "0");
    const anonymous = await browser.newContext();
    try {
      expect(
        (
          await anonymous.request.get(
            `${origin}/api/${project.id}/events/snapshot`,
          )
        ).status(),
      ).toBe(401);
    } finally {
      await anonymous.close();
    }
  } finally {
    await api.dispose();
    await stop();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("compressed current-day snapshots import more than 10,000 events without truncation", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120000);
  if (!baseURL) throw new Error("Missing origin");
  const { loginAsAdmin } = await import("../support/auth");
  await loginAsAdmin(page, baseURL);
  const project = z.object({ id: z.string() }).parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Large live snapshot" },
      })
    ).json(),
  );
  const keys = z
    .array(z.object({ key: z.string() }))
    .parse(
      await (await page.request.post(`/api/${project.id}/apikeys`)).json(),
    );
  const key = keys.at(-1)?.key;
  if (!key) throw new Error("Missing key");
  for (let offset = 0; offset < 10001; offset += 1000) {
    const events = Array.from(
      { length: Math.min(1000, 10001 - offset) },
      (_, index) => ({
        id: crypto.randomUUID(),
        eventType: "live",
        timestamp: new Date().toISOString(),
        properties: {
          amount: 1,
          index: offset + index,
          text: "compressible ".repeat(40),
        },
      }),
    );
    const response = await page.request.post("/api/ingest", {
      headers: { "X-API-KEY": key },
      data: { requestId: crypto.randomUUID(), events },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
  }
  const response = await page.request.get(
    `/api/${project.id}/events/snapshot`,
    { headers: { "Accept-Encoding": "gzip" } },
  );
  expect(response.headers()["content-encoding"]).toBe("gzip");
  const data = analyticsSnapshot.parse(await response.json());
  expect(data.liveEvents).toHaveLength(10001);
  expect(new Set(data.liveEvents.map((row) => row.id)).size).toBe(10001);
  expect(data.files).toHaveLength(0);
  const uncompressed = await page.request.get(
    `/api/${project.id}/events/snapshot`,
    { headers: { "Accept-Encoding": "gzip;q=0" } },
  );
  expect(uncompressed.headers()["content-encoding"]).toBeUndefined();
  expect(
    analyticsSnapshot.parse(await uncompressed.json()).liveEvents,
  ).toHaveLength(10001);
  await page.goto(`/app/${project.id}/queries`);
  await page
    .locator(".cm-content")
    .fill(
      "SELECT count(*) AS total,sum(CAST(properties->>'amount' AS INTEGER)) AS amount,count(DISTINCT id) AS unique_events FROM events",
    );
  await page.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: "10001", exact: true }),
  ).toHaveCount(3);
});
