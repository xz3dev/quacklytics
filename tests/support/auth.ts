import {
  expect,
  type APIRequestContext,
  type Cookie,
  type Page,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { z } from "zod";
const sessions = new Map<string, Cookie[]>();
const sharedSession = z.object({
  origin: z.string(),
  cookies: z
    .object({
      name: z.string(),
      value: z.string(),
      domain: z.string(),
      path: z.string(),
      expires: z.number(),
      httpOnly: z.boolean(),
      secure: z.boolean(),
      sameSite: z.enum(["Strict", "Lax", "None"]),
    })
    .array(),
});
/** Written by global setup so parallel workers share one admin session. */
export const sharedSessionEnv = "E2E_ADMIN_SESSION";

/** Signs the single admin in, registering it on a fresh server. */
export async function signInAsAdmin(api: APIRequestContext, origin: string) {
  const setup = z
    .object({ adminRegistered: z.boolean() })
    .parse(await (await api.get(`${origin}/api/setup`)).json());
  const submit = () =>
    api.post(
      `${origin}/api/auth/${setup.adminRegistered ? "sign-in" : "sign-up"}/email`,
      {
        headers: { Origin: origin },
        data: {
          email: "migration@example.com",
          password: "Migration-test-password-42",
          name: "Migration",
        },
      },
    );
  let response = await submit();
  // Parallel workers share one client address; wait out the sign-in limit.
  while (response.status() === 429) {
    const seconds = z.coerce
      .number()
      .catch(1)
      .parse(response.headers()["x-retry-after"]);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    response = await submit();
  }
  expect(response.ok(), await response.text()).toBeTruthy();
}

function readSharedSession(origin: string) {
  const path = process.env[sharedSessionEnv];
  if (!path) return undefined;
  const session = sharedSession.parse(JSON.parse(readFileSync(path, "utf8")));
  return session.origin === origin ? session.cookies : undefined;
}

// Product-flow fixtures reuse a real session. Dedicated auth tests still exercise
// login/registration explicitly, without weakening production rate limits.
export async function loginAsAdmin(page: Page, origin: string) {
  const cookies = sessions.get(origin) ?? readSharedSession(origin);
  if (cookies) {
    await page.context().addCookies(cookies);
    if ((await page.request.get("/api/me")).ok()) {
      sessions.set(origin, cookies);
      return;
    }
  }
  await signInAsAdmin(page.request, origin);
  sessions.set(origin, await page.context().cookies());
}
