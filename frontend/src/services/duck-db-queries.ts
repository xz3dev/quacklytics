import {useQueries, useQuery, type UseQueryOptions} from "@tanstack/react-query";
import {DuckDbManager} from "@/services/duck-db-manager.ts";
import {QueryResult} from "@lib/trend-queries.ts";
import {useDuckDb} from "@app/duckdb/duckdb-provider.tsx";

export const DUCKDB_INSIGHT_QUERY_KEY = (project: string, uniqId: string) => ['duckdb', project, uniqId] as const

const duckdbApi = {
    query: async (db: DuckDbManager, query: DuckDBQuery): Promise<
        QueryResult<any>
    > => {
        return db.runQuery(query).then((results) => results) as Promise<any>
    }
}

export function useDuckDBQuery(
    project: string,
    uniqId: string,
    query: DuckDBQuery,
    options?: Partial<UseQueryOptions<any, Error>>,
) {
    const db = useDuckDb()
    return useQuery<any, Error>({
        queryKey: DUCKDB_INSIGHT_QUERY_KEY(project, uniqId),
        queryFn: () => duckdbApi.query(db, query),
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: true,
        ...options,
    })
}

export function useDuckDBQueries<T extends DuckDBQuery>(
    project: string,
    queries: Array<{
        uniqId: string
        query: T
        enabled?: boolean
        options?: Partial<UseQueryOptions<any, Error>>
    }>
) {
    const db = useDuckDb()
    return useQueries({
        queries: queries.map(({
                                  uniqId,
                                  query,
                                  enabled = true,
                                  options = {}
                              }): UseQueryOptions<any, Error> => ({
            queryKey: DUCKDB_INSIGHT_QUERY_KEY(project, uniqId),
            queryFn: () => duckdbApi.query(db, query),
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: true,
            enabled,
            ...options,
        }))
        ,
    })
}


interface DuckDBQuery {
    sql: string
    params: any[]
}
