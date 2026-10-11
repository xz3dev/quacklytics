import { z } from "zod";
import { appDb } from "../db/database";
import { RequestError } from "../errors";
import { readApiKeySecret } from "../api-key-secrets";
import { createApiKey } from "../domain/apikeys";
import { json, type ProjectRequest } from "./shared";
export async function apikeysHandler({
  request,
  projectId,
  id,
}: ProjectRequest): Promise<Response> {
  if (request.method === "DELETE") {
    appDb
      .query("DELETE FROM api_keys WHERE id=? AND project=?")
      .run(id ?? 0, projectId);
    return json(null);
  }
  let secret: string | undefined, created: number | undefined;
  if (request.method === "POST")
    ({ id: created, secret } = createApiKey(projectId));
  const rows = z
    .array(
      z.object({
        id: z.number(),
        project: z.string(),
        prefix: z.string(),
        created_at: z.number(),
      }),
    )
    .parse(
      appDb
        .query(
          "SELECT id,project,prefix,created_at FROM api_keys WHERE project=? ORDER BY id",
        )
        .all(projectId),
    );
  const keys = rows.map((row) => ({
    id: row.id,
    project: row.project,
    createdAt: row.created_at,
    key: row.id === created ? secret : row.prefix + "…",
  }));
  if (id) {
    const key = keys.find((key) => key.id === id);
    if (!key) throw new RequestError(404, "ingestion key not found");
    const fullKey = readApiKeySecret(key.id);
    if (!fullKey)
      throw new RequestError(
        409,
        "This older key cannot be recovered. Create a new ingestion key to copy its full value.",
      );
    return json({ ...key, key: fullKey });
  }
  return json(keys);
}
