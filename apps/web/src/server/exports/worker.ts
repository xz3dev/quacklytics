import { z } from "zod";
import {
  appDb,
  projectDatabase,
  closeDatabases,
  evictIdleDatabases,
} from "../db/database";
import { readDataset } from "./dataset";
import { exportProject, cleanupExports } from "./export";
import { exportRequest } from "./protocol";

let closing = false;
const lastCleanup = new Map<string, number>();
let chain: Promise<void> = Promise.resolve();
const projects = new Map<string, Promise<void>>();
function enqueue(project: string) {
  const existing = projects.get(project);
  if (existing) return existing;
  const task = chain
    .then(async () => {
      const db = await projectDatabase(project);
      try {
        await exportProject(db, project);
      } catch (error) {
        db.query("UPDATE jobs SET attempts=attempts+1,error=?").run(
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      } finally {
        // Runs while exports fail too, since agent datasets keep uploading live
        // files. A cleanup failure must not change the export's outcome.
        if (Date.now() - (lastCleanup.get(project) ?? 0) >= 3600_000)
          await cleanupExports(db, project)
            .then(() => lastCleanup.set(project, Date.now()))
            .catch((error) =>
              console.error("Export cleanup failed", project, error),
            );
      }
    })
    .finally(() => {
      projects.delete(project);
      evictIdleDatabases();
    });
  projects.set(project, task);
  chain = task.catch(() => undefined);
  return task;
}
async function answerDataset(project: string) {
  const dataset = closing
    ? null
    : await readDataset(project).catch((error: unknown) => {
        console.error("Dataset capture failed", project, error);
        return null;
      });
  self.postMessage({ type: "dataset", project, dataset });
}
self.onmessage = async (event: MessageEvent<unknown>) => {
  const message = exportRequest.parse(event.data);
  if (message.type === "shutdown") {
    closing = true;
    clearInterval(timer);
    await chain;
    closeDatabases();
    self.postMessage({ type: "shutdown" });
    return;
  }
  // Captures run beside the export queue: a long export must not delay agents.
  if (message.type === "dataset") {
    void answerDataset(message.project);
    return;
  }
  if (closing) return;
  try {
    await enqueue(message.project);
    // An explicit request may have joined a background pass that captured an
    // older revision (or an empty project). Check again after that pass settles.
    if (!closing) await enqueue(message.project);
    self.postMessage({ type: "export", project: message.project, error: null });
  } catch (error) {
    console.error("Export failed", message.project, error);
    self.postMessage({
      type: "export",
      project: message.project,
      error: "Event export failed",
    });
  }
};
let sweeping = false;
async function sweep() {
  if (sweeping || closing) return;
  sweeping = true;
  try {
    const rows = z
      .array(z.object({ id: z.string() }))
      .parse(appDb.query("SELECT id FROM projects WHERE state='ready'").all());
    for (const { id } of rows) {
      if (closing) break;
      await enqueue(id).catch((error) =>
        console.error("Export failed", id, error),
      );
    }
  } finally {
    sweeping = false;
  }
}
const timer = setInterval(() => {
  void sweep();
}, 30000);
void sweep();
