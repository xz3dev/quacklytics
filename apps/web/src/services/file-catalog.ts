import { z } from "zod";
import { catalogAccess } from "@quacklytics/contracts";
import { http } from "@/lib/fetch";
import type { DuckDbManager } from "@/services/duck-db-manager.ts";

export type FileMetadata = z.infer<typeof catalogAccess>;
export const FileCatalogApi = {
  getFiles: async (
    projectId: string,
    db: DuckDbManager,
  ): Promise<FileMetadata[]> => {
    const catalog = await http.get(
      `${projectId}/events/catalog`,
      catalogAccess.array(),
    );
    db.loadState.getState().finishCatalog();
    return catalog;
  },
};
