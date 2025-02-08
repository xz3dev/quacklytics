import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {http} from '@/lib/fetch'
import {sha1Blob} from "@lib/checksums.ts";
import {db} from "@app/duckdb/duckdb.tsx";

export interface FileMetadata {
    name: string
    start: string
    end: string
    validUntil: string | null
    checksum: string
    autoload: boolean
}

export const FILE_CATALOG_KEY = (project: string) => ['fileCatalog', project] as const
export const FILE_KEY = (project: string, file: string) => ['file', project, file] as const

export interface FileDownload {
    filename: string
    blob: Blob
    checksum: string
}
// API functions
export const FileCatalogApi = {
    getFileChecksums: async (): Promise<FileMetadata[]> => {
        return http.get<any>(`test/events/parquet/seq/checksums`)
    },
    downloadFile: async (filename: string): Promise<FileDownload> => {
        const blob = await http.getBlob(`test/events/parquet/seq/download?file=${filename}`)
        return {
            filename,
            blob,
            checksum: await sha1Blob(blob)
        }
    },

}

export function useFileCatalog(projectId: string) {
    return useQuery({
        queryKey: [FILE_CATALOG_KEY(projectId)],
        queryFn: () => FileCatalogApi.getFileChecksums(),
    })
}

export function useDownloadFiles() {
    return useQuery({
        queryKey: [FILE_CATALOG_KEY('test')],
    })
}

export function useDownloadFile() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async ({fileName}: { projectId: string; fileName: string }): Promise<FileDownload | null> => {
            return await FileCatalogApi.downloadFile(fileName)
        },
        onSuccess: async (file: FileDownload | null, {projectId, fileName}) => {
            console.log(`Downloaded ${fileName} from ${projectId}`, file)
            if(file) {
                console.log(`persisting ${fileName}`)
                queryClient.setQueryData<FileDownload>(
                    FILE_KEY(projectId, fileName),
                    () => {
                        return file
                    }
                )
                await db.reimportAllParquetFiles([file])
                await queryClient.invalidateQueries({
                    queryKey: ['duckdb']
                })
            }
        }
    })
}

