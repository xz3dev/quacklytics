import { createStore, type StoreApi } from "@/lib/store";
import { FileCatalogApi } from "@/services/file-catalog";
import type { QueryClient } from "@tanstack/react-query";
import type { DuckDbManager } from "@/services/duck-db-manager";

interface DuckDbFileManagerState {
  loadData: () => Promise<void>;
}
export function createDuckDbFileManager(
  projectId: string,
  dbManager: DuckDbManager,
  queryClient: QueryClient,
): StoreApi<DuckDbFileManagerState> {
  let pending: Promise<void> | undefined;
  return createStore<DuckDbFileManagerState>(() => ({
    loadData: () => {
      if (pending) return pending;
      pending = (async () => {
        dbManager.loadState.getState().setError(null);
        const catalog = await FileCatalogApi.getFiles(projectId, dbManager);
        const changed = await dbManager.setRemoteFiles(catalog);
        dbManager.loadState.getState().finishFiles();
        if (changed)
          void queryClient.invalidateQueries({ queryKey: ["duckdb"] });
      })()
        .catch((error: unknown) => {
          dbManager.loadState
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
        });
      return pending;
    },
  }));
}
