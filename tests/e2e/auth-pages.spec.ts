import { test, expect } from "@playwright/test";
import { z } from "zod";
import { loginAsAdmin } from "../support/auth";
import { withServer } from "../support/server";

test("sign in rejects wrong credentials, then signs in; setup page is closed once an admin exists", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Missing origin");
  // Ensures the single admin account exists before exercising the pages.
  await loginAsAdmin(page, baseURL);
  await page.context().clearCookies();

  await page.goto("/register");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Set up an admin account" }),
  ).toHaveCount(0);

  const email = page.getByLabel("Email", { exact: true });
  await expect(email).toBeFocused();
  await email.fill("migration@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password-1");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/me")).status()).toBe(401);
  await expect(email).toHaveValue("migration@example.com");

  await page
    .getByLabel("Password", { exact: true })
    .fill("Migration-test-password-42");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/me")).ok()).toBeTruthy();
  const account = page.getByRole("button", { name: /^Logged in as/ });
  await expect(account).toContainText("Logged in as");
  await expect(account).toContainText("migration@example.com");
  await account.click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/me")).status()).toBe(401);
});

test("the admin account can only be created through the one-time setup link from the server log", async ({
  page,
}) => {
  // An empty SETUP_TOKEN makes the server generate a random one.
  await withServer({ SETUP_TOKEN: "" }, async (origin, _directory, log) => {
    await expect
      .poll(log, { message: "setup link in the server log" })
      .toContain(`${origin}/register?token=`);
    const link = z.url().parse(log().match(/\S+\/register\?token=\S+/)?.[0]);
    const token = new URL(link).searchParams.get("token") ?? "";
    expect(token.length).toBeGreaterThanOrEqual(32);

    // First-time visitors are sent to setup, which points them to the log.
    await page.goto(origin);
    await expect(page).toHaveURL(`${origin}/register`);
    await expect(
      page.getByRole("status").getByText("Open the one-time setup link"),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "Check the server logs for the URL with the one-time setup link",
    );
    await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
    await page.goto(`${origin}/login`);
    await expect(
      page.getByText(
        "First time here? Check the server logs for the one-time setup link",
      ),
    ).toBeVisible();

    // Registration without the token is refused, whatever the client sends.
    const credentials = {
      email: "setup@example.com",
      password: "Setup-link-password-42",
      name: "Setup",
    };
    const missing = await page.request.post(
      `${origin}/api/auth/sign-up/email`,
      { headers: { Origin: origin }, data: credentials },
    );
    expect(missing.status()).toBe(403);

    const register = async (url: string) => {
      await page.goto(url);
      await page.getByLabel("Email", { exact: true }).fill(credentials.email);
      await page
        .getByLabel("Password", { exact: true })
        .fill(credentials.password);
      await page
        .getByLabel("Confirm password", { exact: true })
        .fill(credentials.password);
      await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
    };
    await register(`${origin}/register?token=wrong-${token}`);
    await expect(page.getByRole("alert")).toContainText(
      "This setup link is invalid or expired",
    );
    expect(
      await (await page.request.get(`${origin}/api/setup`)).json(),
    ).toMatchObject({ adminRegistered: false });
    expect((await page.request.get(`${origin}/api/me`)).status()).toBe(401);

    await register(link);
    await expect(
      page.getByRole("heading", { name: "Projects", exact: true }),
    ).toBeVisible();
    const me = await page.request.get(`${origin}/api/me`);
    expect(me.ok()).toBeTruthy();
    expect(await me.json()).toMatchObject({ email: credentials.email });

    // Once the admin exists, the link no longer opens registration.
    await page.context().clearCookies();
    await page.goto(link);
    await expect(page).toHaveURL(`${origin}/login`);
    await expect(
      page.getByText("Check the server logs for the one-time setup link"),
    ).toHaveCount(0);
  });
});
