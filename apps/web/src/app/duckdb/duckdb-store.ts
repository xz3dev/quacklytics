import { create } from "@/lib/store";
import { FileMetadata } from "@/client/api/analytics.ts";

interface DuckdbStoreState {
  availableFiles: FileMetadata[];
  setAvailableFiles: (files: FileMetadata[]) => void;
}

export const useDuckDBStore2 = create<DuckdbStoreState>((set) => ({
  availableFiles: [],
  setAvailableFiles: (files: FileMetadata[]) => set({ availableFiles: files }),
  loadFile: (filename: string) => {
    console.log(`Loading: ${filename}`);
  },
}));
