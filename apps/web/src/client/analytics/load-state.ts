import { create } from "@/lib/store";
import type { AnalyticsSnapshot } from "../api/analytics";
interface LoadState {
  error: string | null;
  initialized: boolean;
  catalogReady: boolean;
  filesReady: boolean;
  freshness: AnalyticsSnapshot | null;
  refreshedAt: string | null;
  setError: (error: string | null) => void;
  finishInit: () => void;
  finishCatalog: () => void;
  finishFiles: (freshness: AnalyticsSnapshot) => void;
  isLoading: () => boolean;
}
export const createLoadStore = () =>
  create<LoadState>((set, get) => ({
    error: null,
    initialized: false,
    catalogReady: false,
    filesReady: false,
    freshness: null,
    refreshedAt: null,
    setError: (error) => set({ error }),
    finishInit: () => set({ initialized: true }),
    finishCatalog: () => set({ catalogReady: true }),
    finishFiles: (freshness) =>
      set({
        filesReady: true,
        freshness,
        refreshedAt: new Date().toISOString(),
      }),
    isLoading: () =>
      !get().initialized || !get().catalogReady || !get().filesReady,
  }));
