import { z } from "zod";
import { appDb } from "./db/database";

appDb.exec(`CREATE TABLE IF NOT EXISTS api_key_secrets(
  id INTEGER PRIMARY KEY REFERENCES api_keys(id) ON DELETE CASCADE,
  value TEXT NOT NULL
)`);

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
