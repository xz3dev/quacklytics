import {createStore, StoreApi} from 'zustand';
import {FILE_KEY, FileCatalogApi, FileDownload, FileMetadata} from '@/services/file-catalog';
import {QueryClient} from '@tanstack/react-query';
import {DuckDbManager} from "@/services/duck-db-manager.ts";
import {UTCDate} from "@date-fns/utc";
import {EventsApi} from "@/services/events.ts";

interface DuckDbFileManagerState {
    filesToLoad: FileMetadata[];
    loadMetadata: () => Promise<void>;
    downloadFiles: () => Promise<FileDownload[]>;
    loadRecentEvents: () => Promise<void>;
    loadData: () => Promise<void>;
}

type DuckDbFileManagerStore = StoreApi<DuckDbFileManagerState>;

export const createDuckDbFileManager = (
    projectId: string,
    dbManager: DuckDbManager,
    queryClient: QueryClient,
): DuckDbFileManagerStore => {
    return createStore<DuckDbFileManagerState>((set, get) => ({
        filesToLoad: [],

        loadData: async () => {
            const s = get()
            await s.loadMetadata()
            await s.downloadFiles()
            await s.loadRecentEvents()
        },

        loadMetadata: async () => {
            const files = await FileCatalogApi.getFileChecksums(projectId, dbManager);
            const shouldLoadFile = (f: FileMetadata) => {
                if (f.autoload) return true;
                const cache = queryClient.getQueryData<FileMetadata>(FILE_KEY(projectId, f));
                return cache && cache.checksum === f.checksum;
            };
            const filteredFiles = files.filter(shouldLoadFile);
            set({filesToLoad: filteredFiles});
        },

        downloadFiles: async () => {
            const files = get().filesToLoad;
            const downloads = await Promise.all(
                files.map(async (f) => FileCatalogApi.downloadFile(projectId, f, dbManager)),
            );
            for (const download of downloads) {
                queryClient.setQueryData(FILE_KEY(projectId, download), download)
            }
            await dbManager.importParquet(downloads);
            return downloads;
        },

        loadRecentEvents: async () => {
            const availableFiles = get().filesToLoad
            const dates = availableFiles.map(it => it.end)
            const maxDate = Math.max(...dates.map(date => new UTCDate(date).getTime()))
            await EventsApi.fetchEvents(projectId, new UTCDate(maxDate), dbManager)
            dbManager.downloadState.getState().finishTask('Recent Events', 'load')
        }
    }));
};
