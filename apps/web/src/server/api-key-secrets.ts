import { z } from "zod";
import { appDb } from "./db/database";

export function storeApiKeySecret(id: number, secret: string) {
  appDb
    .query("INSERT INTO api_key_secrets(id,value) VALUES(?,?)")
    .run(id, secret);
}

export function readApiKeySecret(id: number): string | undefined {
  const row = z
    .object({ value: z.string() })
    .nullable()
    .parse(appDb.query("SELECT value FROM api_key_secrets WHERE id=?").get(id));
  return row?.value;
}
