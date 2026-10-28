import { test, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { countryDatabase } from "../support/mmdb";

const exec = promisify(execFile);
const docker = async (...args: string[]) => (await exec("docker", args)).stdout;
const origin = "http://127.0.0.1:4176";

test("published image initializes beside a GeoIP cache, exports history, queries both stores, and survives restart", async ({
  page,
}) => {
  const image = process.env.QUACKLYTICS_TEST_IMAGE ?? "quacklytics-image-test";
  const suffix = crypto.randomUUID();
  const container = `quacklytics-image-${suffix}`;
  const volume = `quacklytics-image-data-${suffix}`;
  const fixtures = mkdtempSync(join(tmpdir(), "quacklytics-image-"));
  // The image runs as bun, which must be able to read this public test fixture.
  chmodSync(fixtures, 0o755);
  writeFileSync(
    join(fixtures, "countries.mmdb"),
    countryDatabase({ "8.8.8.0/24": "US" }),
  );
  const endpoint = new URL(z.url().parse(process.env.S3_ENDPOINT));
  const networkArgs: string[] = [];
  if (["localhost", "127.0.0.1"].includes(endpoint.hostname)) {
    const garage = (
      await docker(
        "compose",
        "-f",
        "compose.dev.yml",
        "ps",
        "--quiet",
        "garage",
      )
    ).trim();
    const networks = z
      .record(z.string(), z.unknown())
      .parse(
        JSON.parse(
          await docker(
            "inspect",
            "--format",
            "{{json .NetworkSettings.Networks}}",
            garage,
          ),
        ),
      );
    const network = Object.keys(networks).at(0);
    if (!network || Object.keys(networks).length !== 1)
      throw new Error("Expected one development storage network");
    networkArgs.push("--network", network);
    endpoint.hostname = "garage";
  }
  const ready = async () => {
    await expect
      .poll(async () => {
        try {
          return (await page.request.get("/api/health")).status();
        } catch {
          return 0;
        }
      })
      .toBe(200);
  };
  try {
    // Reproduce the on-disk state created by GeoIP before the first API request.
    // Use the actual image, its dependencies, its default user, and a fresh volume.
    await docker(
      "run",
      "--rm",
      "--entrypoint",
      "bun",
      "--mount",
      `type=volume,source=${volume},target=/data`,
      "--mount",
      `type=bind,source=${fixtures},target=/fixtures,readonly`,
      image,
      "-e",
      'import {mkdirSync,copyFileSync} from "node:fs";mkdirSync("/data/geoip");copyFileSync("/fixtures/countries.mmdb","/data/geoip/countries.mmdb");',
    );
    await docker(
      "run",
      "--detach",
      "--name",
      container,
      ...networkArgs,
      "--publish",
      "127.0.0.1:4176:3000",
      "--mount",
      `type=volume,source=${volume},target=/data`,
      "--env",
      `APP_ORIGIN=${origin}`,
      "--env",
      "GEOIP_DB_PATH=/data/geoip/countries.mmdb",
      "--env",
      `S3_ENDPOINT=${endpoint.href}`,
      "--env",
      "S3_PUBLIC_ENDPOINT",
      "--env",
      "S3_REGION",
      "--env",
      "S3_BUCKET",
      "--env",
      "S3_ACCESS_KEY_ID",
      "--env",
      "S3_SECRET_ACCESS_KEY",
      image,
    );
    await ready();
    expect(await (await page.request.get("/api/setup")).json()).toMatchObject({
      adminRegistered: false,
    });
    expect((await page.request.get("/api/projects")).status()).toBe(401);
    const password = `Image-test-${crypto.randomUUID()}`;
    await page.goto("/register");
    await page.getByLabel("Email", { exact: true }).fill("image@example.com");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Projects", exact: true }),
    ).toBeVisible();
    const createProject = async (name: string) => {
      const response = await page.request.post("/api/projects", {
        headers: { Origin: origin },
        data: { name },
      });
      expect(response.ok(), await response.text()).toBeTruthy();
      return z.object({ id: z.string() }).parse(await response.json());
    };
    const project = await createProject("Production image");
    const isolated = await createProject("Isolated project");
    const keys = await page.request.post(`/api/${project.id}/apikeys`);
    expect(keys.ok()).toBeTruthy();
    const key = z
      .array(z.object({ key: z.string() }))
      .parse(await keys.json())
      .at(-1)?.key;
    if (!key) throw new Error("Missing ingestion key");
    const events = [
      {
        id: crypto.randomUUID(),
        eventType: "historical",
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        eventType: "live",
        timestamp: new Date().toISOString(),
      },
    ];
    const ingest = (ingestionKey: string, input: unknown) =>
      page.request.post("/api/ingest", {
        headers: { "X-API-KEY": ingestionKey },
        data: input,
      });
    const response = await ingest(key, {
      requestId: crypto.randomUUID(),
      events,
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    expect(await response.json()).toMatchObject({
      committed: 2,
      duplicates: 0,
    });
    const duplicate = await ingest(key, {
      requestId: crypto.randomUUID(),
      events,
    });
    expect(await duplicate.json()).toMatchObject({
      committed: 0,
      duplicates: 2,
    });
    expect((await ingest("invalid", {})).status()).toBe(401);
    expect((await ingest(key, {})).status()).toBe(400);
    const exported = await page.request.post(
      `/api/${project.id}/events/catalog/gen`,
    );
    expect(exported.ok(), await exported.text()).toBeTruthy();
    const files = z
      .array(z.object({ url: z.url(), eventCount: z.number() }))
      .parse(await exported.json());
    expect(files.map((file) => file.eventCount)).toEqual([1]);
    const file = files.at(0);
    if (!file) throw new Error("Missing history export");
    const range = await page.request.get(file.url, {
      headers: { Origin: origin, Range: "bytes=0-3" },
    });
    expect(range.status()).toBe(206);
    expect((await range.body()).toString()).toBe("PAR1");
    expect(range.headers()["access-control-allow-origin"]).toBe(origin);
    expect(
      await (await page.request.get(`/api/${isolated.id}/events`)).json(),
    ).toEqual([]);
    const query = async () => {
      await page.goto(`/app/${project.id}/queries`);
      await expect(page.locator(".cm-content")).toBeVisible();
      await page
        .locator(".cm-content")
        .fill("SELECT count(*) AS total FROM events");
      await page.getByRole("button", { name: "Execute", exact: true }).click();
      await expect(
        page.getByRole("cell", { name: "2", exact: true }),
      ).toBeVisible();
    };
    await query();
    await docker("restart", container);
    await ready();
    expect(await (await page.request.get("/api/setup")).json()).toMatchObject({
      adminRegistered: true,
    });
    const persisted = await page.request.get(`/api/${project.id}/events`);
    expect(persisted.ok()).toBeTruthy();
    expect(
      z
        .array(z.object({ eventType: z.string() }))
        .parse(await persisted.json())
        .map((event) => event.eventType)
        .sort(),
    ).toEqual(["historical", "live"]);
    expect(
      await (await page.request.get(`/api/${isolated.id}/events`)).json(),
    ).toEqual([]);
    await query();
    await page.context().clearCookies();
    await page.goto("/register");
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get(`/api/${project.id}/events`)).status()).toBe(
      401,
    );
  } catch (error) {
    const logs = await exec("docker", ["logs", container]).catch(
      () => undefined,
    );
    console.error(logs ? logs.stdout + logs.stderr : "Container not created");
    throw error;
  } finally {
    await docker("rm", "--force", container).catch(() => undefined);
    await docker("volume", "rm", volume).catch(() => undefined);
    rmSync(fixtures, { recursive: true, force: true });
  }
});
