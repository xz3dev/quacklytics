import { useDebouncedValue } from "@tanstack/react-pacer";
import {
  useQueries,
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { useDuckDb } from "@/app/duckdb/duckdb-provider";
import type { ResultRow } from "@quacklytics/contracts";
import type { QueryParamValue } from "@/lib/queries";
interface DuckDBQuery {
  sql: string;
  params: QueryParamValue[];
}
export const DUCKDB_INSIGHT_QUERY_KEY = (project: string, uniqId: string) =>
  ["duckdb", project, uniqId] as const;
export function useDuckDBQuery(
  project: string,
  uniqId: string,
  query: DuckDBQuery,
  options?: Partial<UseQueryOptions<ResultRow[], Error>>,
) {
  const db = useDuckDb();
  const [paced] = useDebouncedValue(query, { wait: 150 });
  return useQuery({
    queryKey: [
      ...DUCKDB_INSIGHT_QUERY_KEY(project, uniqId),
      paced.sql,
      paced.params,
    ],
    queryFn: () => db.runQuery(paced),
    ...options,
  });
}
export function useDuckDBQueries(
  project: string,
  queries: Array<{
    uniqId: string;
    query: DuckDBQuery;
    enabled?: boolean;
    options?: Partial<UseQueryOptions<ResultRow[], Error>>;
  }>,
) {
  const db = useDuckDb();
  return useQueries({
    queries: queries.map(({ uniqId, query, enabled = true, options }) => ({
      queryKey: [
        ...DUCKDB_INSIGHT_QUERY_KEY(project, uniqId),
        query.sql,
        query.params,
      ],
      queryFn: () => db.runQuery(query),
      enabled,
      ...options,
    })),
  });
}
