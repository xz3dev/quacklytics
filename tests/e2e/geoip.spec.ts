import { test, expect, request } from "@playwright/test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { z } from "zod";
import { countryDatabase } from "../support/mmdb";

const eventRows = z.array(
  z.object({
    eventType: z.string(),
    properties: z.record(z.string(), z.json()),
  }),
);

test("browser events gain the visitor's country from the trusted client address", async () => {
  const directory = mkdtempSync(join(tmpdir(), "quacklytics-geoip-"));
  const database = join(directory, "countries.mmdb");
  writeFileSync(
    database,
    countryDatabase({ "8.8.8.0/24": "US", "203.0.113.0/24": "DE" }),
  );
  const origin = "http://127.0.0.1:4179";
  let log = "";
  const server = spawn("bun", ["server.ts"], {
    cwd: resolve("apps/web"),
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: "4179",
      APP_ORIGIN: origin,
      DATA_DIR: join(directory, "data"),
      GEOIP: "on",
      GEOIP_DB_PATH: database,
      // Test requests arrive over loopback, standing in for a reverse proxy.
      TRUSTED_PROXIES: "loopback",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
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
            email: "geoip@example.com",
            password: "Geoip-password-123",
            name: "GeoIP",
          },
        })
      ).ok(),
      log,
    ).toBeTruthy();
    const project = z
      .object({ id: z.string() })
      .parse(
        await (
          await api.post("/api/projects", { data: { name: "GeoIP" } })
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

    const event = (
      eventType: string,
      properties: Record<string, string> = {},
      id: string = crypto.randomUUID(),
    ) => ({
      kind: "event",
      id,
      timestamp: new Date().toISOString(),
      eventType,
      properties,
      context: { sdk: { name: "@quacklytics/client", version: "0.2.0" } },
      anonymous: true,
    });
    const send = async (
      forwardedFor: string,
      data: unknown,
      headers: Record<string, string> = {},
    ) => {
      const response = await api.post("/api/ingest", {
        headers: {
          "X-API-KEY": key,
          "X-Forwarded-For": forwardedFor,
          ...headers,
        },
        data,
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return z
        .object({ committed: z.number(), duplicates: z.number() })
        .parse(await response.json());
    };
    const sdk = (operation: unknown) => ({
      protocolVersion: 1,
      requestId: crypto.randomUUID(),
      operations: [operation],
    });

    const visit = event("german_visit");
    await send("203.0.113.5", sdk(visit));
    await send("198.51.100.7", sdk(event("unknown_network")));
    await send("2001:db8::1", sdk(event("ipv6_visit")));
    await send("203.0.113.5", sdk(event("explicit", { $country: "FR" })));
    // A client cannot inject the country header the gateway forwards.
    await send("198.51.100.7", sdk(event("forged_header")), {
      "X-Quacklytics-Country": "JP",
    });
    // Server-side HTTP clients would report their own location, not a visitor's.
    await send("203.0.113.5", {
      requestId: crypto.randomUUID(),
      events: [
        {
          id: crypto.randomUUID(),
          eventType: "server_side",
          timestamp: new Date().toISOString(),
        },
      ],
    });
    // A retry resolving to another country is still the same event.
    expect(await send("8.8.8.8", sdk(visit))).toMatchObject({
      committed: 0,
      duplicates: 1,
    });

    const rows = eventRows.parse(
      await (await api.get(`/api/${project.id}/events`)).json(),
    );
    const country = (eventType: string) =>
      rows.find((row) => row.eventType === eventType)?.properties.$country;
    expect(rows).toHaveLength(6);
    expect(country("german_visit")).toBe("DE");
    expect(country("unknown_network")).toBeUndefined();
    expect(country("ipv6_visit")).toBeUndefined();
    expect(country("explicit")).toBe("FR");
    expect(country("forged_header")).toBeUndefined();
    expect(country("server_side")).toBeUndefined();
    expect(JSON.stringify(rows)).not.toMatch(/203\.0\.113|198\.51\.100/);
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
