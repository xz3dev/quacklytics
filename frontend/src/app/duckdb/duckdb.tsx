import {useEffect, useMemo, useRef, useState} from "react";
import {DuckDbManager} from "@/services/duck-db-manager.ts";
import {FILE_KEY, FileCatalogApi, useFileCatalog} from "@/services/file-catalog.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useQueries} from "@tanstack/react-query";
import {DuckDBLoadingIndicator} from "@app/duckdb/duckdb-loading-indicator.tsx";

export const db = new DuckDbManager()

export function DuckDB(props: { children: React.ReactNode }) {
    const projectId = useProjectId()
    const availableFiles = useFileCatalog(projectId)

    const [isImportingData, setIsImportingData] = useState(true)

    const autoloadFiles = useMemo(() => {
        return availableFiles
                .data
                ?.filter(f => f.autoload)
                ?.map(file => file)
            ?? []
    }, [availableFiles])

    const fileQueries = useQueries({
        queries: autoloadFiles.map((f) => ({
            queryFn: () => FileCatalogApi.downloadFile(f),
            queryKey: FILE_KEY(projectId, f),
            staleTime: Infinity,
            gcTime: 1000 * 60 * 60 * 24 * 14, // 14 days
        })),
        combine: (queries) => {
            if(queries.some(q => q.status === 'error')) {
                return queries.map(q => q.error?.message).join('\n')
            }
            if(queries.every(q => q.status === 'success')) {
                return queries.map(q => q.data)
            }
            return []
        },
    })

    if(typeof fileQueries === 'string') {
        console.error(fileQueries)
    }

    const importedChecksums = useRef<Set<string>>(new Set([]))
    useEffect(() => {
        if(Array.isArray(fileQueries) && typeof fileQueries !== 'string') {
            const importedSet = importedChecksums.current
            const newSet = new Set(fileQueries.map(f => f.checksum))
            if(!eqSet(newSet, importedSet)) {
                importedChecksums.current = newSet
                db.importParquet(fileQueries).then(() => setIsImportingData(false))
            }
        }
    }, [fileQueries]);

    return (
        <>
            <DuckDBLoadingIndicator isLoading={isImportingData}>
                {props.children}
            </DuckDBLoadingIndicator>
        </>
    )
}

const eqSet = (xs: Set<any>, ys: Set<any>) =>
    xs.size === ys.size &&
    [...xs].every((x) => ys.has(x));
