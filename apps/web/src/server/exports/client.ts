import { resolve } from "node:path";
import type { z } from "zod";
import { exportResponse, type dataset } from "./protocol";
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
type Dataset = z.infer<typeof dataset>;
const datasets = new Map<
  string,
  {
    promise: Promise<Dataset>;
    resolve: (dataset: Dataset) => void;
    reject: (error: Error) => void;
  }
>();
function getWorker() {
  if (worker) return worker;
  const instance = new Worker(
    resolve(
      process.cwd(),
      // Bun can replace process.env.NODE_ENV while bundling; choose at runtime.
      Bun.env.NODE_ENV === "production"
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
    if (message.type === "dataset") {
      const task = datasets.get(message.project);
      datasets.delete(message.project);
      if (message.dataset) task?.resolve(message.dataset);
      else task?.reject(new Error("Dataset unavailable; retry later"));
      return;
    }
    const task = pending.get(message.project);
    pending.delete(message.project);
    if (message.error) task?.reject(new Error(message.error));
    else task?.resolve();
  };
  instance.onerror = () => {
    if (worker !== instance) return;
    for (const task of [...pending.values(), ...datasets.values()])
      task.reject(new Error("Export worker stopped"));
    pending.clear();
    datasets.clear();
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
/** One consistent, signed snapshot of every event; concurrent requests share it. */
export async function requestDataset(project: string) {
  const existing = datasets.get(project);
  if (existing) return existing.promise;
  if (closing)
    return Promise.reject(new RequestError(503, "Server shutting down"));
  const backend = getWorker();
  const task = Promise.withResolvers<Dataset>();
  datasets.set(project, task);
  try {
    backend.postMessage({ type: "dataset", project });
  } catch (error) {
    datasets.delete(project);
    task.reject(
      error instanceof Error ? error : new Error("Dataset unavailable"),
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
