import {create} from 'zustand';

const ranges = ["3", "6", "12"] as const;
type DownloadRange = typeof ranges[number];

interface AppDataState {
    downloadRange: DownloadRange
}

const useAppDataStore = create<AppDataState>((set) => ({
    downloadRange: '6',
}));

export default useAppDataStore;
