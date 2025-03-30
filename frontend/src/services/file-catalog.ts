import {QueryClient, useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {http} from '@/lib/fetch'
import {useDuckDb} from "@app/duckdb/duckdb-provider.tsx";
import {DuckDbManager} from "@/services/duck-db-manager.ts";
import {AxiosRequestConfig} from "axios";

export interface FileMetadata {
    name: string
    start: string
    end: string
    validUntil: string | null
    checksum: string
    autoload: boolean
    filesize: number
    eventCount: number
}

export const FILE_CATALOG_KEY = (project: string) => ['fileCatalog', project] as const
export const FILE_KEY = (project: string, file: FileMetadata) => ['file', project, file.name, file.checksum] as const

export type FileDownload = FileMetadata & {
    blob: Blob
}
// API functions
export const FileCatalogApi = {
    getFileChecksums: async (projectId: string, db: DuckDbManager): Promise<FileMetadata[]> => {
        const catalog = await http.get<any>(`${projectId}/events/catalog`)
        db.downloadState.getState().finishTask('Metadata', 'load')
        return catalog
    },
    downloadFile: async (qc: QueryClient, projectId: string, file: FileMetadata, db: DuckDbManager): Promise<FileDownload> => {
        db.downloadState.getState().addTask(file.name, 'load')
        db.downloadState.getState().addTask(file.name, 'import')
        const cache = qc.getQueryData<FileDownload>(FILE_KEY(projectId, file))
        if(cache && cache.checksum === file.checksum) {
            db.downloadState.getState().finishTask(file.name, 'load')
            return cache
        }
        const blob = await http.getBlob(
            `${projectId}/events/download?file=${file.name}&checksum=${file.checksum}`,
            {
                onDownloadProgress: (p) => {
                    console.log(p)
                    const percentCompleted = Math.round(p.loaded * 100 / p.bytes);
                    db.downloadState.getState().updateTaskProgress(file.name, 'load', percentCompleted)
                }
            } satisfies AxiosRequestConfig
        )
        db.downloadState.getState().finishTask(file.name, 'load')
        return {
            ...file,
            blob,
        }
    },
}

export function useFileCatalog(projectId: string) {
    const db = useDuckDb()
    return useQuery({
        queryKey: FILE_CATALOG_KEY(projectId),
        queryFn: () => FileCatalogApi.getFileChecksums(projectId, db),
    })
}

export function useDownloadFile() {
    const queryClient = useQueryClient()
    const db = useDuckDb()
    return useMutation({
        gcTime: 1000 * 60 * 60 * 24 * 14,
        mutationFn: async ({projectId, file}: { projectId: string; file: FileMetadata }): Promise<FileDownload | null> => {
            const cache = queryClient.getQueryData<FileDownload>(FILE_KEY(projectId, file))
            if(cache && cache.checksum === file.checksum) {
                console.log(`using cached ${file.name}`)
                return cache
            }
            console.log(`downloading ${file.name}`)
            return await FileCatalogApi.downloadFile(queryClient, projectId, file, db)
        },
        onSuccess: async (file: FileDownload | null, {projectId}) => {
            console.log(`Downloaded ${file} from ${projectId}`, file)
            if(file) {
                console.log(`persisting ${file}`)
                await queryClient.fetchQuery({
                    queryKey: FILE_KEY(projectId, file),
                    queryFn: () => file,
                    staleTime: Infinity,
                    gcTime: 1000 * 60 * 60 * 24 * 14,
                })
                await db.importParquet([file])
                await queryClient.invalidateQueries({
                    queryKey: ['duckdb']
                })
            }
        },
    })
}

