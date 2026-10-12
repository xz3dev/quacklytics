import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { appDb, dataRoot } from "./db/database";
import { ImmediateSqliteDialect } from "./db/auth-dialect";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const secretFile = join(dataRoot, "auth-secret");
if (!existsSync(secretFile))
  writeFileSync(secretFile, crypto.randomUUID() + crypto.randomUUID(), {
    mode: 0o600,
  });
const options = {
  database: { dialect: new ImmediateSqliteDialect(appDb), type: "sqlite" },
  secret: process.env.AUTH_SECRET ?? readFileSync(secretFile, "utf8"),
  baseURL: process.env.APP_ORIGIN ?? "http://127.0.0.1:3000",
  advanced: { ipAddress: { ipAddressHeaders: ["x-quacklytics-client-ip"] } },
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  databaseHooks: {
    user: {
      create: {
        before: async () => {
          if (appDb.query("SELECT id FROM user LIMIT 1").get())
            throw new APIError("FORBIDDEN", {
              message: "Registration is closed",
            });
        },
      },
    },
  },
} satisfies BetterAuthOptions;
export const authReady = Promise.resolve();

export const auth = betterAuth(options);
