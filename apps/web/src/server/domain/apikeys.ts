import { appDb } from "../db/database";
import { hash } from "../ingestion/process";
import { storeApiKeySecret } from "../api-key-secrets";

/** Stores a new key; its full value is only returned here and on reads. */
export function createApiKey(projectId: string) {
  const secret = crypto.randomUUID() + crypto.randomUUID();
  const id = appDb
    .transaction(() => {
      const keyId = Number(
        appDb
          .query(
            "INSERT INTO api_keys(project,digest,prefix,created_at) VALUES(?,?,?,?)",
          )
          .run(projectId, hash(secret), secret.slice(0, 8), Date.now())
          .lastInsertRowid,
      );
      storeApiKeySecret(keyId, secret);
      return keyId;
    })
    .immediate();
  return { id, secret };
}
