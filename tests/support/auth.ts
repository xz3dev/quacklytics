import { expect, type Cookie, type Page } from "@playwright/test";
import { z } from "zod";
const sessions = new Map<string, Cookie[]>();
// Product-flow fixtures reuse a real session. Dedicated auth tests still exercise
// login/registration explicitly, without weakening production rate limits.
export async function loginAsAdmin(page: Page, origin: string) {
  const cookies = sessions.get(origin);
  if (cookies) {
    await page.context().addCookies(cookies);
    if ((await page.request.get("/api/me")).ok()) return;
  }
  const setup = z
    .object({ adminRegistered: z.boolean() })
    .parse(await (await page.request.get("/api/setup")).json());
  const response = await page.request.post(
    `/api/auth/${setup.adminRegistered ? "sign-in" : "sign-up"}/email`,
    {
      headers: { Origin: origin },
      data: {
        email: "migration@example.com",
        password: "Migration-test-password-42",
        name: "Migration",
      },
    },
  );
  expect(response.ok(), await response.text()).toBeTruthy();
  sessions.set(origin, await page.context().cookies());
}
