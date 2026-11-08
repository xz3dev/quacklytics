import { randomBytes, timingSafeEqual } from "node:crypto";
import { appDb } from "./db/database";

export const appOrigin = process.env.APP_ORIGIN ?? "http://127.0.0.1:3000";

// Kept in memory only: unless SETUP_TOKEN fixes it for automated setups, each
// backend start issues a fresh link. It stops working once the admin exists.
const token = process.env.SETUP_TOKEN || randomBytes(24).toString("base64url");

export const adminRegistered = () =>
  !!appDb.query("SELECT id FROM user LIMIT 1").get();

/** Logs the one-time link for creating the admin account, if still needed. */
export function announceSetupLink() {
  if (adminRegistered()) return;
  const link = new URL("/register", appOrigin);
  link.searchParams.set("token", token);
  console.log(
    `No admin account exists yet. Create it with this one-time setup link:\n  ${link.href}`,
  );
}

export function isSetupToken(candidate: string | null | undefined) {
  const expected = Buffer.from(token);
  const actual = Buffer.from(candidate ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
