import { randomBytes } from "node:crypto";
import { z } from "zod";
import { appDb } from "../db/database";

export type AnonymousVisitors = { current: string; previous?: string };
const saltRow = z.object({ day: z.string(), salt: z.instanceof(Uint8Array) });
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cookieless visitor IDs for events whose visitor declined analytics. The IP
 * and user agent are hashed with a random salt per UTC day; salts older than
 * yesterday are deleted, after which no ID can be linked back to a visitor.
 * Yesterday's ID lets a visit that crosses midnight keep its session.
 */
export function anonymousVisitors(
  project: string,
  ip: string,
  userAgent: string,
  now = Date.now(),
): AnonymousVisitors {
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - DAY_MS).toISOString().slice(0, 10);
  const salts = appDb.transaction(() => {
    appDb.query("DELETE FROM anonymous_salts WHERE day < ?").run(yesterday);
    appDb
      .query("INSERT OR IGNORE INTO anonymous_salts(day,salt) VALUES(?,?)")
      .run(today, randomBytes(16));
    return z
      .array(saltRow)
      .parse(
        appDb
          .query("SELECT day,salt FROM anonymous_salts WHERE day IN (?,?)")
          .all(today, yesterday),
      );
  })();
  const visitor = (day: string) => {
    const salt = salts.find((row) => row.day === day)?.salt;
    return salt
      ? `daily:${new Bun.CryptoHasher("sha256", salt).update(`${project}|${ip}|${userAgent}`).digest("hex")}`
      : undefined;
  };
  const current = visitor(today);
  if (!current) throw new Error("Anonymous salt unavailable");
  const previous = visitor(yesterday);
  return previous ? { current, previous } : { current };
}
