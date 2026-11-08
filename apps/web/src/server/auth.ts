import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { appDb, dataRoot } from "./db/database";
import { ImmediateSqliteDialect } from "./db/auth-dialect";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupTokenHeader } from "@quacklytics/contracts";
import { adminRegistered, appOrigin, isSetupToken } from "./setup-token";
const secretFile = join(dataRoot, "auth-secret");
if (!existsSync(secretFile))
  writeFileSync(secretFile, crypto.randomUUID() + crypto.randomUUID(), {
    mode: 0o600,
  });
const options = {
  database: { dialect: new ImmediateSqliteDialect(appDb), type: "sqlite" },
  secret: process.env.AUTH_SECRET ?? readFileSync(secretFile, "utf8"),
  baseURL: appOrigin,
  advanced: { ipAddress: { ipAddressHeaders: ["x-quacklytics-client-ip"] } },
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  databaseHooks: {
    user: {
      create: {
        before: async (_user, context) => {
          if (adminRegistered())
            throw new APIError("FORBIDDEN", {
              message: "Registration is closed",
            });
          if (!isSetupToken(context?.headers?.get(setupTokenHeader)))
            throw new APIError("FORBIDDEN", {
              message:
                "This setup link is invalid or expired. Check the server logs for the current one-time setup link.",
            });
        },
      },
    },
  },
} satisfies BetterAuthOptions;
export const authReady = Promise.resolve();

export const auth = betterAuth(options);
