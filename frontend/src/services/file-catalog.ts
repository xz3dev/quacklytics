import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {http} from '@/lib/fetch'
import {db} from "@app/duckdb/duckdb.tsx";

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
    getFileChecksums: async (projectId: string): Promise<FileMetadata[]> => {
        return http.get<any>(`${projectId}/events/catalog`)
    },
    downloadFile: async (projectId: string, file: FileMetadata): Promise<FileDownload> => {
        const blob = await http.getBlob(`${projectId}/events/download?file=${file.name}&checksum=${file.checksum}`)
        return {
            ...file,
            blob,
        }
    },
}

export function useFileCatalog(projectId: string) {
    return useQuery({
        queryKey: FILE_CATALOG_KEY(projectId),
        queryFn: () => FileCatalogApi.getFileChecksums(projectId),
    })
}

export function useDownloadFile() {
    const queryClient = useQueryClient()
    return useMutation({
        gcTime: 1000 * 60 * 60 * 24 * 14,
        mutationFn: async ({projectId, file}: { projectId: string; file: FileMetadata }): Promise<FileDownload | null> => {
            const cache = queryClient.getQueryData<FileDownload>(FILE_KEY(projectId, file))
            if(cache && cache.checksum === file.checksum) {
                console.log(`using cached ${file.name}`)
                return cache
            }
            console.log(`downloading ${file.name}`)
            return await FileCatalogApi.downloadFile(projectId, file)
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

