import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../support/auth";

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
