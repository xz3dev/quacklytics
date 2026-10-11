import { handleApi } from "./http";
import { workerRequest } from "./worker-protocol";
import { closeDatabases, evictIdleDatabases } from "./db/database";
import { recoverProjects } from "./domain/projects";
import { startExports, shutdownExports } from "./exports/client";
await recoverProjects();
startExports();
let active = 0;
function finished() {
  active--;
  if (active === 0) evictIdleDatabases();
}
self.onmessage = async (event: MessageEvent<unknown>) => {
  const message = workerRequest.parse(event.data);
  if (message.type === "shutdown") {
    await shutdownExports();
    closeDatabases();
    self.postMessage({ type: "shutdown" });
    return;
  }
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
      type: "response",
      id: message.id,
      status: response.status,
      headers: [...response.headers],
      body: new Uint8Array(await response.arrayBuffer()),
    });
  } catch (error) {
    console.error(error);
    self.postMessage({
      type: "response",
      id: message.id,
      status: 500,
      headers: [],
      body: JSON.stringify({ error: "Worker request failed" }),
    });
  } finally {
    finished();
  }
};
