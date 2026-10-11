import { getAnalyticsSnapshot } from "../api/analytics";
import type { DuckDbManager } from "./manager";
import type { QueryClient } from "@tanstack/react-query";

export const REFRESH_INTERVAL_MS = 15000;

export function createDuckDbFileManager(
  projectId: string,
  db: DuckDbManager,
  queryClient: QueryClient,
) {
  let pending: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let started = false;
  let closed = false;
  const controller = new AbortController();
  function schedule() {
    clearTimeout(timer);
    if (closed || !started || document.visibilityState === "hidden") return;
    timer = setTimeout(() => {
      void loadData().catch(() => undefined);
    }, REFRESH_INTERVAL_MS);
  }
  function loadData(): Promise<void> {
    if (closed)
      return Promise.reject(new DOMException("Project closed", "AbortError"));
    if (pending) return pending;
    clearTimeout(timer);
    pending = (async () => {
      db.loadState.getState().setError(null);
      const status = await getAnalyticsSnapshot(projectId, controller.signal);
      if (closed) return;
      db.loadState.getState().finishCatalog();
      const changed = await db.setSnapshot(status);
      if (closed) return;
      db.loadState.getState().finishFiles(status);
      if (changed)
        // A query may itself be waiting for renewed file access. Do not await
        // its invalidation/refetch here, which would create a dependency cycle.
        void queryClient.invalidateQueries({
          queryKey: ["duckdb", projectId],
        });
    })()
      .catch((error: unknown) => {
        if (!closed)
          db.loadState
            .getState()
            .setError(
              error instanceof Error
                ? error.message
                : "Unable to load analytics",
            );
        throw error;
      })
      .finally(() => {
        pending = undefined;
        schedule();
      });
    return pending;
  }
  function onVisibility() {
    clearTimeout(timer);
    if (document.visibilityState === "visible")
      void loadData().catch(() => undefined);
  }
  return {
    loadData,
    start() {
      if (started || closed) return;
      started = true;
      document.addEventListener("visibilitychange", onVisibility);
      void loadData().catch(() => undefined);
    },
    close() {
      closed = true;
      clearTimeout(timer);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
