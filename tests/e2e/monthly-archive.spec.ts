import { test, expect, request } from "@playwright/test";
import { execFile, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import {
  analyticsSnapshot,
  catalogAccess,
  schemaResponse,
} from "../../packages/contracts/src/index";

test("complete months leave SQLite a week after they end, once their S3 copy verifies, and change only by backfill", async ({
  page,
}) => {
  test.setTimeout(120000);
  // The server reads S3 through this proxy; the browser reads S3 directly.
  // While corrupting, stored Parquet reads back with one flipped byte.
  const storage = new URL(z.string().parse(process.env.S3_ENDPOINT));
  let corrupt = true;
  const proxy = createServer((incoming, outgoing) => {
    const target = new URL(incoming.url ?? "/", storage);
    const tamper =
      corrupt &&
      incoming.method === "GET" &&
      target.pathname.endsWith(".parquet");
    const forward = (target.protocol === "https:" ? httpsRequest : httpRequest)(
      target,
      { method: incoming.method, headers: incoming.headers },
      (response) => {
        if (!tamper) {
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
          response.pipe(outgoing);
          return;
        }
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const body = Buffer.concat(chunks);
          const middle = Math.floor(body.length / 2);
          body[middle] = (body[middle] ?? 0) ^ 0xff;
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
          outgoing.end(body);
        });
      },
    );
    forward.on("error", () => {
      outgoing.writeHead(502);
      outgoing.end();
    });
    incoming.pipe(forward);
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  const { port } = z.object({ port: z.number() }).parse(proxy.address());
  const directory = mkdtempSync(join(tmpdir(), "quacklytics-archive-"));
  const clock = join(directory, "clock");
  writeFileSync(clock, "2026-10-06T12:00:00.000Z");
  // Shares hybrid-analytics' port: the dev bucket CORS allows only listed origins.
  const origin = "http://127.0.0.1:4176";
  let log = "";
  const server = spawn(
    "bun",
    ["--preload", resolve("tests/fixtures/analytics-clock.ts"), "server.ts"],
    {
      cwd: resolve("apps/web"),
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: "4176",
        APP_ORIGIN: origin,
        DATA_DIR: join(directory, "data"),
        ANALYTICS_TEST_CLOCK: clock,
        S3_ENDPOINT: `http://127.0.0.1:${port}`,
        S3_PUBLIC_ENDPOINT: process.env.S3_PUBLIC_ENDPOINT ?? storage.href,
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
            email: "archive@example.com",
            password: "Archive-password-123",
            name: "Archive",
          },
        })
      ).ok(),
      log,
    ).toBeTruthy();
    const project = z
      .object({ id: z.string() })
      .parse(
        await (
          await api.post("/api/projects", { data: { name: "Archive" } })
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
    type Event = {
      id: string;
      eventType: string;
      timestamp: string;
      sessionId?: string;
      personId?: string;
      properties?: Record<string, unknown>;
    };
    const ingest = (
      events: Event[],
      path = "/api/ingest",
      requestId = crypto.randomUUID(),
    ) =>
      api.post(path, {
        headers: { "X-API-KEY": key },
        data: { requestId, events },
      });
    const accepted = async (events: Event[], path?: string) => {
      const response = await ingest(events, path);
      expect(response.ok(), await response.text()).toBeTruthy();
      return z
        .object({
          committed: z.number(),
          duplicates: z.number(),
          rejected: z.number(),
        })
        .parse(await response.json());
    };
    const event = (
      eventType: string,
      timestamp: string,
      fields: Partial<Event> = {},
    ): Event => ({ id: crypto.randomUUID(), eventType, timestamp, ...fields });
    const snapshot = async () =>
      analyticsSnapshot.parse(
        await (await api.get(`/api/${project.id}/events/snapshot`)).json(),
      );
    const publish = () => api.post(`/api/${project.id}/events/catalog/gen`);
    // SQLite contents have no read API; inspect which rows left the events table.
    const stored = async () =>
      z
        .object({ live: z.array(z.string()), archived: z.array(z.string()) })
        .parse(
          JSON.parse(
            (
              await promisify(execFile)("bun", [
                "-e",
                `
                import { Database } from "bun:sqlite";
                const db = new Database(Bun.argv.at(-1), { readonly: true });
                const column = (sql) => db.query(sql).values().map((row) => row[0]);
                console.log(JSON.stringify({
                  live: column("SELECT event_type FROM events ORDER BY timestamp"),
                  archived: column("SELECT partition FROM archived_partitions ORDER BY partition"),
                }));
                db.close();
              `,
                join(
                  directory,
                  "data",
                  "projects",
                  project.id,
                  "project.sqlite",
                ),
              ])
            ).stdout,
          ),
        );

    const first = event("sept-first", "2026-09-10T08:00:00.000Z", {
      properties: { plan: "pro" },
    });
    await accepted([
      first,
      event("sept-last", "2026-09-30T23:59:59.999Z"),
      event("october", "2026-10-02T00:00:00.000Z"),
    ]);
    const months = (files: z.infer<typeof catalogAccess>[]) =>
      files.map((file) => [file.partition, file.end, file.eventCount]);

    // Within the grace week the complete month is published but kept in SQLite,
    // so the corrupting proxy is never consulted.
    const graced = await publish();
    expect(graced.ok(), log).toBeTruthy();
    expect(months(catalogAccess.array().parse(await graced.json()))).toEqual([
      ["2026-09", "2026-10-01T00:00:00.000Z", 2],
      ["2026-10", "2026-10-06T00:00:00.000Z", 1],
    ]);
    expect(await stored()).toEqual({
      live: ["sept-first", "sept-last", "october"],
      archived: [],
    });

    // A stored copy that does not read back intact must not cost SQLite rows.
    writeFileSync(clock, "2026-10-08T00:00:01.000Z");
    expect((await publish()).ok()).toBeFalsy();
    expect(await stored()).toEqual({
      live: ["sept-first", "sept-last", "october"],
      archived: [],
    });
    expect((await snapshot()).liveEvents).toHaveLength(3);

    corrupt = false;
    const published = await publish();
    expect(published.ok(), log).toBeTruthy();
    expect(months(catalogAccess.array().parse(await published.json()))).toEqual(
      [
        ["2026-09", "2026-10-01T00:00:00.000Z", 2],
        ["2026-10", "2026-10-08T00:00:00.000Z", 1],
      ],
    );
    expect(await stored()).toEqual({
      live: ["october"],
      archived: ["2026-09"],
    });
    expect(await snapshot()).toMatchObject({
      liveEvents: [],
      availableStart: "2026-09-10T08:00:00.000Z",
      availableEnd: "2026-10-02T00:00:00.001Z",
    });
    expect(
      Object.keys(
        schemaResponse.parse(
          await (await api.get(`/api/${project.id}/schema`)).json(),
        ),
      ).sort(),
    ).toEqual(["october", "sept-first", "sept-last"]);

    // Ordinary ingestion drops archived-month events individually and keeps the rest.
    expect(
      await accepted([
        event("sept-rejected", "2026-09-15T00:00:00.000Z"),
        event("october-late", "2026-10-03T00:00:00.000Z"),
      ]),
    ).toEqual({
      committed: 1,
      duplicates: 0,
      rejected: 1,
    });
    expect((await stored()).live).toEqual(["october", "october-late"]);

    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning")
        browserErrors.push(
          message.text().replace(/\?X-Amz-[^\s']+/g, "?[redacted]"),
        );
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await page.context().addCookies((await api.storageState()).cookies);
    await page.goto(`${origin}/app/${project.id}/queries`);
    const query = async (sql: string, expected: string) => {
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
    await query("SELECT count(*) AS total FROM events", "4");
    await query(
      "SELECT properties->>'plan' AS plan FROM events WHERE event_type='sept-first'",
      "pro",
    );

    // Backfill merges into the stored month before responding. Re-sent archived
    // events keep their stored content instead of duplicating.
    const backfill = [
      { ...first, properties: { plan: "free" } },
      event("sept-backfill", "2026-09-20T00:00:00.000Z"),
    ];
    corrupt = true;
    const backfillId = crypto.randomUUID();
    expect(
      (await ingest(backfill, "/api/backfill", backfillId)).ok(),
    ).toBeFalsy();
    // Unmerged backfill stays durable in SQLite but hidden behind the stored month.
    expect((await stored()).live).toEqual([
      "sept-first",
      "sept-backfill",
      "october",
      "october-late",
    ]);
    const pending = await snapshot();
    expect(pending.liveEvents.map((row) => row.event_type)).toEqual([
      "october",
      "october-late",
    ]);
    expect(
      pending.files.find((file) => file.partition === "2026-09"),
    ).toMatchObject({ eventCount: 2 });
    corrupt = false;
    const merged = await ingest(backfill, "/api/backfill", backfillId);
    expect(merged.ok(), await merged.text()).toBeTruthy();
    expect(
      catalogAccess
        .array()
        .parse(
          await (await api.get(`/api/${project.id}/events/catalog`)).json(),
        )
        .find((file) => file.partition === "2026-09"),
    ).toMatchObject({ eventCount: 3, end: "2026-10-01T00:00:00.000Z" });
    expect(await stored()).toEqual({
      live: ["october", "october-late"],
      archived: ["2026-09"],
    });
    await page.reload();
    await query("SELECT count(*) AS total FROM events", "5");
    await query("SELECT count(DISTINCT id) AS total FROM events", "5");
    await query(
      "SELECT properties->>'plan' AS plan FROM events WHERE event_type='sept-first'",
      "pro",
    );
    await query(
      "SELECT count(*) AS backfilled FROM events WHERE event_type='sept-backfill'",
      "1",
    );
  } finally {
    await api.dispose();
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGKILL");
      await exited;
    }
    proxy.closeAllConnections();
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    rmSync(directory, { recursive: true, force: true });
  }
});
