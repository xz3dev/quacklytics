import { z } from "zod";
import { parseJson, projectEmoji } from "@quacklytics/contracts";
import { appDb, projectDatabase, setting, setSetting } from "../db/database";
import { RequestError } from "../errors";
import { createTemplate } from "./templates";
import { createApiKey } from "./apikeys";
import { listDashboards } from "./dashboards";
import {
  listProjectRecords,
  insertProject,
  markProjectReady,
  projectExists,
  renameProject,
  updateProjectEmoji,
} from "../repositories/projects";
export async function listProjects() {
  return Promise.all(
    listProjectRecords(appDb, "ready").map(async (row) => {
      const db = await projectDatabase(row.id);
      return {
        ...row,
        partition: "month",
        corsOrigins: z
          .array(z.string())
          .parse(parseJson(setting(db, "cors_origins"))),
      };
    }),
  );
}
export async function createProject(input: { name: string; emoji: string }) {
  const id = crypto.randomUUID();
  insertProject(appDb, id, input.name, input.emoji);
  const db = await projectDatabase(id);
  createTemplate(db, "web_analytics", true);
  createApiKey(id);
  markProjectReady(appDb, id);
  const result = (await listProjects()).find((p) => p.id === id);
  if (!result) throw new Error("Project creation failed");
  return result;
}
export function requireProject(id: string) {
  if (!projectExists(appDb, id))
    throw new RequestError(404, "Project not found");
  return projectDatabase(id);
}
export async function updateSettings(id: string, input: unknown) {
  const db = await requireProject(id);
  const updates = z
    .array(
      z.discriminatedUnion("key", [
        z.object({
          key: z.literal("name"),
          value: z.string().trim().min(1).max(200),
        }),
        z.object({ key: z.literal("emoji"), value: projectEmoji }),
        z.object({ key: z.literal("cors_origins"), value: z.string() }),
      ]),
    )
    .parse(input);
  for (const update of updates) {
    if (update.key === "name") {
      renameProject(appDb, id, z.string().min(1).max(200).parse(update.value));
    } else if (update.key === "emoji") {
      updateProjectEmoji(appDb, id, update.value);
    } else {
      const origins = update.value.trim().startsWith("[")
        ? z.array(z.string()).parse(parseJson(update.value))
        : update.value
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean);
      for (const origin of origins) {
        if (origin !== "*" && new URL(origin).origin !== origin)
          throw new RequestError(
            400,
            "Origins must contain only scheme and host",
          );
      }
      setSetting(db, "cors_origins", JSON.stringify(origins));
    }
  }
  return listProjects();
}

export async function recoverProjects() {
  for (const row of listProjectRecords(appDb, "provisioning")) {
    const db = await projectDatabase(row.id);
    if (!listDashboards(db).length) createTemplate(db, "web_analytics", true);
    if (!appDb.query("SELECT 1 FROM api_keys WHERE project=?").get(row.id))
      createApiKey(row.id);
    markProjectReady(appDb, row.id);
  }
}
