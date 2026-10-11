import type { QueryClient } from "@tanstack/react-query";
import { insightList } from "./insights";
import { dashboardList } from "./dashboards";

/** Lists are the canonical cache; detail hooks and DB collections derive from them. */
export async function refreshProjectEntities(
  client: QueryClient,
  project: string,
  insightsChanged = false,
) {
  await Promise.all([
    client.invalidateQueries({
      queryKey: dashboardList(project).queryKey,
      refetchType: "all",
    }),
    ...(insightsChanged
      ? [
          client.invalidateQueries({
            queryKey: insightList(project).queryKey,
            refetchType: "all",
          }),
        ]
      : []),
  ]);
}
