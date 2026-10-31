import { z } from "zod";
import { appDb } from "../db/database";
import { RequestError } from "../errors";
import { hash } from "../ingestion/process";

const tokenRow = z.object({
  id: z.number(),
  secret: z.string(),
  created_at: z.number(),
});
// Lists show only the prefix; the full secret is revealed one token at a time.
const prefix = (secret: string) => secret.slice(0, 12);

export function listMcpTokens(userId: string) {
  return z
    .array(tokenRow)
    .parse(
      appDb
        .query(
          "SELECT id,secret,created_at FROM mcp_tokens WHERE user_id=? ORDER BY id",
        )
        .all(userId),
    )
    .map((row) => ({
      id: row.id,
      prefix: prefix(row.secret),
      createdAt: row.created_at,
    }));
}

export function revealMcpToken(userId: string, id: number) {
  const row = tokenRow
    .nullable()
    .parse(
      appDb
        .query(
          "SELECT id,secret,created_at FROM mcp_tokens WHERE id=? AND user_id=?",
        )
        .get(id, userId),
    );
  if (!row) throw new RequestError(404, "Access token not found");
  return {
    id: row.id,
    prefix: prefix(row.secret),
    createdAt: row.created_at,
    token: row.secret,
  };
}

export function createMcpToken(userId: string) {
  const secret =
    "qmcp_" + (crypto.randomUUID() + crypto.randomUUID()).replaceAll("-", "");
  const createdAt = Date.now();
  const id = Number(
    appDb
      .query(
        "INSERT INTO mcp_tokens(user_id,digest,secret,created_at) VALUES(?,?,?,?)",
      )
      .run(userId, hash(secret), secret, createdAt).lastInsertRowid,
  );
  return { id, prefix: prefix(secret), createdAt, token: secret };
}

export function deleteMcpToken(userId: string, id: number) {
  appDb
    .query("DELETE FROM mcp_tokens WHERE id=? AND user_id=?")
    .run(id, userId);
}

export function mcpTokenUser(token: string) {
  return z
    .object({ user_id: z.string() })
    .nullable()
    .parse(
      appDb
        .query("SELECT user_id FROM mcp_tokens WHERE digest=?")
        .get(hash(token)),
    )?.user_id;
}
