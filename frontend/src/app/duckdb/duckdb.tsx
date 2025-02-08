import {useEffect, useMemo, useRef} from "react";
import {DuckDbManager} from "@/services/duck-db-manager.ts";
import {FILE_KEY, FileCatalogApi, useFileCatalog} from "@/services/file-catalog.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useQueries} from "@tanstack/react-query";

export const db = new DuckDbManager()

export function DuckDB(props: { children: React.ReactNode }) {
    const projectId = useProjectId()
    const availableFiles = useFileCatalog(projectId)

    const autoloadFiles = useMemo(() => {
        return availableFiles
                .data
                ?.filter(f => f.autoload)
                ?.map(file => file.name)
            ?? []
    }, [availableFiles])

    const fileQueries = useQueries({
        queries: autoloadFiles.map((f) => ({
            queryFn: () => FileCatalogApi.downloadFile(f),
            queryKey: FILE_KEY(projectId, f),
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
        console.log(fileQueries)
        if(Array.isArray(fileQueries) && typeof fileQueries !== 'string') {
            const importedSet = importedChecksums.current
            const newSet = new Set(fileQueries.map(f => f.checksum))
            if(!eqSet(newSet, importedSet)) {
                importedChecksums.current = newSet
                void db.reimportAllParquetFiles(fileQueries)
            } else {
                console.log(`Skipping update.`, importedSet, newSet)
            }
        }
    }, [fileQueries]);

    return (
        <>
            {props.children}
        </>
    )
}

const eqSet = (xs: Set<any>, ys: Set<any>) =>
    xs.size === ys.size &&
    [...xs].every((x) => ys.has(x));
