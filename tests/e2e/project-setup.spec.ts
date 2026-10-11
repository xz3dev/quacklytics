import { test, expect, type Page } from "@playwright/test";
import { z } from "zod";
import { loginAsAdmin } from "../support/auth";

const keys = z.array(z.object({ id: z.number(), key: z.string() }));
const projects = z.array(
  z.object({ id: z.string(), corsOrigins: z.array(z.string()) }),
);
const check = (page: Page, title: string | RegExp) =>
  page
    .getByRole("list", { name: "Setup checks" })
    .getByRole("listitem")
    .filter({ has: page.getByText(title) });

test("a new project walks through sending and verifying its first events", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing baseURL");
  await loginAsAdmin(page, baseURL);
  const shop = `https://shop-${crypto.randomUUID().slice(0, 8)}.example`;

  await page.goto("/projects/new");
  await page.getByLabel("Project name", { exact: true }).fill("Setup E2E");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/setup$/);
  const projectId = new URL(page.url()).pathname.split("/")[2] ?? "";
  await expect(
    page.getByRole("heading", { name: "Send your first event to Setup E2E" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Waiting for your first event",
  );

  // Creating the project also created exactly one key, shown in full.
  const created = keys.parse(
    await (await page.request.get(`/api/${projectId}/apikeys`)).json(),
  );
  expect(created).toHaveLength(1);
  const keyId = created[0]?.id;
  const key = z
    .object({ key: z.string() })
    .parse(
      await (
        await page.request.get(`/api/${projectId}/apikeys/${keyId}`)
      ).json(),
    ).key;
  await page.getByRole("tab", { name: "HTTP" }).click();
  await expect(page.locator("pre")).toContainText(`X-API-Key: ${key}`);
  await expect(page.locator("pre")).toContainText(`${baseURL}/api/ingest`);

  const ingest = (
    headers: Record<string, string>,
    event: Record<string, unknown> = {},
  ) =>
    page.request.post("/api/ingest", {
      headers: { "X-API-Key": key, ...headers },
      data: {
        requestId: crypto.randomUUID(),
        events: [
          {
            id: crypto.randomUUID(),
            eventType: "setup_test",
            timestamp: new Date().toISOString(),
            ...event,
          },
        ],
      },
    });

  // Mistakes that never reach the project still show up while waiting.
  expect((await ingest({ "X-API-Key": "wrong-key" })).status()).toBe(401);
  await expect(
    page.getByText("A request used an unknown ingestion key"),
  ).toBeVisible();
  const preflight = await page.request.fetch("/api/ingest", {
    method: "OPTIONS",
    headers: { Origin: shop },
  });
  expect(preflight.status()).toBe(403);
  await page.getByRole("button", { name: `Allow ${shop}` }).click();
  await expect(
    page.getByRole("button", { name: `Allow ${shop}` }),
  ).toBeHidden();
  expect(
    projects
      .parse(await (await page.request.get("/api/projects")).json())
      .find((project) => project.id === projectId)?.corsOrigins,
  ).toEqual([shop]);

  // A browser event relayed by a proxy the server does not trust.
  expect(
    (
      await ingest(
        { Origin: shop, "X-Forwarded-For": "203.0.113.9" },
        { personId: "user:setup-test" },
      )
    ).ok(),
  ).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: /needs attention/ }),
  ).toBeVisible();
  await expect(check(page, "Event received")).toContainText("setup_test");
  await expect(check(page, "Event received")).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(check(page, "Sent over the HTTP API")).toHaveAttribute(
    "data-state",
    "pass",
  );
  await expect(check(page, "Visitor identified")).toContainText(
    "user:setup-test",
  );
  await expect(check(page, "Browser origin allowed")).toContainText(shop);
  const proxy = check(
    page,
    "Requests reach Quacklytics through an untrusted proxy",
  );
  await expect(proxy).toHaveAttribute("data-state", "fail");
  await expect(proxy).toContainText("203.0.113.9");
  await expect(proxy).toContainText("TRUSTED_PROXIES=loopback");
  await expect(
    page.getByText("A request used an unknown ingestion key"),
  ).toBeHidden();
  await expect(
    page
      .getByRole("list", { name: "Setup progress" })
      .getByRole("listitem")
      .filter({ hasText: "Verify" }),
  ).toHaveAttribute("aria-current", "step");

  // The checks follow the latest event: a direct server request without a
  // visitor.
  expect((await ingest({})).ok()).toBeTruthy();
  await expect(check(page, "Real visitor address visible")).toContainText(
    "connecting directly",
  );
  await expect(check(page, "No visitor attached")).toHaveAttribute(
    "data-state",
    "warn",
  );
  await expect(
    page.getByRole("heading", { name: "You're all set" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Open project" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${projectId}`));
});

test("the setup page creates a key for a project that has none", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing baseURL");
  await loginAsAdmin(page, baseURL);
  const projectId = z.object({ id: z.string() }).parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Keyless", emoji: "" },
      })
    ).json(),
  ).id;
  const list = async () =>
    keys.parse(
      await (await page.request.get(`/api/${projectId}/apikeys`)).json(),
    );
  for (const { id } of await list())
    expect(
      (await page.request.delete(`/api/${projectId}/apikeys/${id}`)).ok(),
    ).toBeTruthy();
  expect(await list()).toHaveLength(0);

  await page.goto(`/projects/${projectId}/setup`);
  await page.getByRole("tab", { name: "HTTP" }).click();
  await expect(page.locator("pre")).toContainText(/X-API-Key: [0-9a-f-]{72}/);
  await expect.poll(async () => (await list()).length).toBe(1);
  await page.reload();
  await page.getByRole("tab", { name: "HTTP" }).click();
  await expect(page.locator("pre")).toContainText(/X-API-Key: [0-9a-f-]{72}/);
  expect(await list()).toHaveLength(1);
});

test("the ingestion page shows how to send data with the project's key", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing baseURL");
  await loginAsAdmin(page, baseURL);
  const projectId = z.object({ id: z.string() }).parse(
    await (
      await page.request.post("/api/projects", {
        data: { name: "Ingestion snippets", emoji: "" },
      })
    ).json(),
  ).id;
  const list = async () =>
    keys.parse(
      await (await page.request.get(`/api/${projectId}/apikeys`)).json(),
    );
  const [created] = await list();
  const key = z
    .object({ key: z.string() })
    .parse(
      await (
        await page.request.get(`/api/${projectId}/apikeys/${created?.id}`)
      ).json(),
    ).key;

  await page.goto(`/app/${projectId}/ingestion`);
  const section = page.getByRole("region", { name: "Send data" });
  await expect(section).toContainText("No origins allowed yet");
  await section.getByRole("tab", { name: "HTTP" }).click();
  await expect(section.locator("pre")).toContainText(`X-API-Key: ${key}`);

  // Unlike the setup page, deleting the last key does not create a new one.
  expect(
    (
      await page.request.delete(`/api/${projectId}/apikeys/${created?.id}`)
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Send data" })
      .getByText("Create an ingestion key to see code examples"),
  ).toBeVisible();
  expect(await list()).toHaveLength(0);
});
