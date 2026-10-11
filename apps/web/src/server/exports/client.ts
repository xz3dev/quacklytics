import { resolve } from "node:path";
import { exportResponse } from "./protocol";
import { RequestError } from "../errors";
let worker: Worker | undefined;
let closing = false;
let supervisor: ReturnType<typeof setInterval> | undefined;
let finishShutdown: (() => void) | undefined;
const pending = new Map<
  string,
  {
    promise: Promise<void>;
    resolve: () => void;
    reject: (error: Error) => void;
  }
>();
function getWorker() {
  if (worker) return worker;
  const instance = new Worker(
    resolve(
      process.cwd(),
      process.env.NODE_ENV === "production"
        ? "dist/export-worker.js"
        : "src/server/exports/worker.ts",
    ),
  );
  instance.onmessage = (event: MessageEvent<unknown>) => {
    if (worker !== instance) return;
    const message = exportResponse.parse(event.data);
    if (message.type === "shutdown") {
      finishShutdown?.();
      return;
    }
    const task = pending.get(message.project);
    pending.delete(message.project);
    if (message.error) task?.reject(new Error(message.error));
    else task?.resolve();
  };
  instance.onerror = () => {
    if (worker !== instance) return;
    for (const task of pending.values())
      task.reject(new Error("Export worker stopped"));
    pending.clear();
    instance.terminate();
    worker = undefined;
    finishShutdown?.();
  };
  worker = instance;
  return instance;
}
export async function requestExport(project: string): Promise<void> {
  const existing = pending.get(project);
  if (existing) return existing.promise;
  if (closing || pending.size >= 64)
    return Promise.reject(
      new RequestError(503, "Export queue busy; retry later"),
    );
  const backend = getWorker();
  const task = Promise.withResolvers<void>();
  pending.set(project, task);
  try {
    backend.postMessage({ type: "export", project });
  } catch (error) {
    pending.delete(project);
    task.reject(
      error instanceof Error ? error : new Error("Export unavailable"),
    );
  }
  return task.promise;
}
export function startExports() {
  const ensureWorker = () => {
    if (closing) return;
    try {
      getWorker();
    } catch (error) {
      console.error("Unable to start export worker", error);
    }
  };
  ensureWorker();
  // Restart failed workers even when no browser is requesting a catalog.
  supervisor ??= setInterval(ensureWorker, 30000);
}
export async function shutdownExports() {
  closing = true;
  clearInterval(supervisor);
  const backend = worker;
  if (!backend) return;
  await new Promise<void>((resolve) => {
    finishShutdown = resolve;
    backend.postMessage({ type: "shutdown" });
  });
  backend.terminate();
  worker = undefined;
}
