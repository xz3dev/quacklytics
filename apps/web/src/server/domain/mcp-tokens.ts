import { z } from "zod";
import { appDb } from "../db/database";
import { hash } from "../ingestion/process";

const tokenRow = z.object({
  id: z.number(),
  prefix: z.string(),
  created_at: z.number(),
});

export function listMcpTokens(projectId: string) {
  return z
    .array(tokenRow)
    .parse(
      appDb
        .query(
          "SELECT id,prefix,created_at FROM mcp_tokens WHERE project=? ORDER BY id",
        )
        .all(projectId),
    )
    .map((row) => ({
      id: row.id,
      prefix: row.prefix,
      createdAt: row.created_at,
    }));
}

/** The secret is returned only here; afterwards only its digest exists. */
export function createMcpToken(projectId: string) {
  const secret =
    "qmcp_" + (crypto.randomUUID() + crypto.randomUUID()).replaceAll("-", "");
  const createdAt = Date.now();
  const id = Number(
    appDb
      .query(
        "INSERT INTO mcp_tokens(project,digest,prefix,created_at) VALUES(?,?,?,?)",
      )
      .run(projectId, hash(secret), secret.slice(0, 12), createdAt)
      .lastInsertRowid,
  );
  return { id, prefix: secret.slice(0, 12), createdAt, token: secret };
}

export function deleteMcpToken(projectId: string, id: number) {
  appDb
    .query("DELETE FROM mcp_tokens WHERE id=? AND project=?")
    .run(id, projectId);
}

export function mcpTokenProject(token: string) {
  return z
    .object({ project: z.string() })
    .nullable()
    .parse(
      appDb
        .query("SELECT project FROM mcp_tokens WHERE digest=?")
        .get(hash(token)),
    )?.project;
}
