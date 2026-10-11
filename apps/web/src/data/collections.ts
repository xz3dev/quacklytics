import { createCollection, useLiveQuery } from "@tanstack/react-db";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { insight, dashboard } from "@quacklytics/contracts";
import { insightList } from "./insights";
import { dashboardList } from "./dashboards";
function makeCollections(client: QueryClient, id: string) {
  return {
    insights: createCollection(
      queryCollectionOptions({
        id: `insights-${id}`,
        ...insightList(id),
        queryClient: client,
        schema: insight,
        getKey: (row) => row.id,
      }),
    ),
    dashboards: createCollection(
      queryCollectionOptions({
        id: `dashboards-${id}`,
        ...dashboardList(id),
        queryClient: client,
        schema: dashboard,
        getKey: (row) => row.id,
      }),
    ),
  };
}
const scopes = new WeakMap<
  QueryClient,
  Map<string, ReturnType<typeof makeCollections>>
>();
export function useCollections(id: string) {
  const client = useQueryClient();
  return useMemo(() => {
    let projects = scopes.get(client);
    if (!projects) {
      projects = new Map();
      scopes.set(client, projects);
    }
    let collections = projects.get(id);
    if (!collections) {
      collections = makeCollections(client, id);
      projects.set(id, collections);
    }
    return collections;
  }, [client, id]);
}
export function useInsightCollection(id: string) {
  const { insights } = useCollections(id);
  const result = useLiveQuery((q) => q.from({ insight: insights }));
  return {
    ...result,
    error: result.isError ? new Error("Unable to load insights") : null,
  };
}
export function useDashboardCollection(id: string) {
  const { dashboards } = useCollections(id);
  const result = useLiveQuery((q) => q.from({ dashboard: dashboards }));
  return {
    ...result,
    error: result.isError ? new Error("Unable to load dashboards") : null,
  };
}
