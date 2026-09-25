import { handleApi } from "./http";
import { workerRequest } from "./worker-protocol";
import {
  closeDatabases,
  evictIdleDatabases,
  appDb,
  projectDatabase,
} from "./db/database";
import { recoverProjects } from "./projects";
import { exportProject, cleanupExports } from "./exports/export";
import { z } from "zod";
recoverProjects();
let active = 0;
function finished() {
  active--;
  if (active === 0) evictIdleDatabases();
}
self.onmessage = async (event: MessageEvent<unknown>) => {
  const message = workerRequest.parse(event.data);
  active++;
  try {
    const response = await handleApi(
      new Request(message.url, {
        method: message.method,
        headers: message.headers,
        ...(message.body === undefined ? {} : { body: message.body }),
      }),
    );
    self.postMessage({
      id: message.id,
      status: response.status,
      headers: [...response.headers],
      body: await response.text(),
    });
  } catch (error) {
    console.error(error);
    self.postMessage({
      id: message.id,
      status: 500,
      headers: [],
      body: JSON.stringify({ error: "Worker request failed" }),
    });
  } finally {
    finished();
  }
};
process.on("exit", closeDatabases);

let exporting = false;
setInterval(() => {
  void (async () => {
    if (exporting) return;
    exporting = true;
    active++;
    try {
      for (const { id } of z
        .array(z.object({ id: z.string() }))
        .parse(
          appDb.query("SELECT id FROM projects WHERE state='ready'").all(),
        )) {
        const db = projectDatabase(id);
        try {
          await exportProject(db, id);
          await cleanupExports(db, id);
        } catch (error) {
          db.query("UPDATE jobs SET attempts=attempts+1,error=?").run(
            error instanceof Error ? error.message : String(error),
          );
          console.error("Export failed", id, error);
        }
      }
    } finally {
      exporting = false;
      finished();
    }
  })();
}, 30000);
