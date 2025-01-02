import {useQueries, useQuery, type UseQueryOptions} from "@tanstack/react-query";
import {useDB} from "@app/duckdb/duckdb.tsx";
import {DuckDbManager} from "@/services/duck-db-manager.ts";
import {buildQuery, Query} from "@lib/queries.ts";

export const DUCKDB_INSIGHT_QUERY_KEY = (project: string, uniqId: string) => ['duckdb', project, uniqId] as const

type QueryResult = any

const duckdbApi = {
    query: async (db: DuckDbManager, query: Query): Promise<any> => {
        const q = buildQuery(query)
        return db.runQuery(q.sql, q.params)
    }
}

export function useDuckDBQuery(
    project: string,
    uniqId: string,
    query: Query,
    options?: Partial<UseQueryOptions<QueryResult, Error>>,
) {
    const db = useDB()
    return useQuery<QueryResult, Error>({
        queryKey: DUCKDB_INSIGHT_QUERY_KEY(project, uniqId),
        queryFn: () => duckdbApi.query(db, query),
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: true,
        placeholderData: null,
        ...options,
    })
}

export function useDuckDBQueries(
    project: string,
    queries: Array<{
        uniqId: string
        query: Query
        enabled?: boolean
        options?: Partial<UseQueryOptions<QueryResult, Error>>
    }>
) {
    const db = useDB()

    return useQueries({
        queries: queries.map(({ uniqId, query, enabled = true, options = {} }) => ({
            queryKey: DUCKDB_INSIGHT_QUERY_KEY(project, uniqId),
            queryFn: () => duckdbApi.query(db, query),
            select: (data) => data,
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: true,
            placeholderData: null,
            enabled,
            ...options,
        }))
    })
}
