import { create } from "@/lib/store";
interface LoadState {
  error: string | null;
  initialized: boolean;
  catalogReady: boolean;
  filesReady: boolean;
  setError: (error: string | null) => void;
  finishInit: () => void;
  finishCatalog: () => void;
  finishFiles: () => void;
  isLoading: () => boolean;
}
export const useDuckDbLoadStore = () =>
  create<LoadState>((set, get) => ({
    error: null,
    initialized: false,
    catalogReady: false,
    filesReady: false,
    setError: (error) => set({ error }),
    finishInit: () => set({ initialized: true }),
    finishCatalog: () => set({ catalogReady: true }),
    finishFiles: () => set({ filesReady: true }),
    isLoading: () =>
      !get().initialized || !get().catalogReady || !get().filesReady,
  }));
