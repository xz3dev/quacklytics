import {useQueries, useQuery, type UseQueryOptions} from "@tanstack/react-query";
import {DuckDbManager} from "@/services/duck-db-manager.ts";
import {Query, QueryResult} from "@lib/queries.ts";
import {useDuckDb} from "@app/duckdb/duckdb-provider.tsx";

export const DUCKDB_INSIGHT_QUERY_KEY = (project: string, uniqId: string) => ['duckdb', project, uniqId] as const

const duckdbApi = {
    query: async <T extends Query>(db: DuckDbManager, query: T): Promise<
        QueryResult<T>
    > => {
        return db.runQuery(query).then((results) => results) as Promise<QueryResult<T>>
    }
}

export function useDuckDBQuery<T extends Query>(
    project: string,
    uniqId: string,
    query: T,
    options?: Partial<UseQueryOptions<QueryResult<T>, Error>>,
) {
    const db = useDuckDb()
    return useQuery<QueryResult<T>, Error>({
        queryKey: DUCKDB_INSIGHT_QUERY_KEY(project, uniqId),
        queryFn: () => duckdbApi.query(db, query),
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: true,
        ...options,
    })
}

export function useDuckDBQueries<T extends Query>(
    project: string,
    queries: Array<{
        uniqId: string
        query: T
        enabled?: boolean
        options?: Partial<UseQueryOptions<QueryResult<T>, Error>>
    }>
) {
    const db = useDuckDb()
    return useQueries({
        queries: queries.map(({
                                  uniqId,
                                  query,
                                  enabled = true,
                                  options = {}
                              }): UseQueryOptions<QueryResult<T>, Error> => ({
            queryKey: DUCKDB_INSIGHT_QUERY_KEY(project, uniqId),
            queryFn: () => duckdbApi.query<T>(db, query),
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: true,
            enabled,
            ...options,
        }))
        ,
    })
}
