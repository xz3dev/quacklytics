import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { insightsApi } from "@/client/api/insights";
import { insightList } from "@/data/insights";
import { refreshProjectEntities } from "@/data/synchronize";
import type { Insight, UsableInsightInput } from "@/model/insights/insight";

export function useInsights(project: string) {
  return useQuery(insightList(project));
}
export function useInsight(project: string, id: number) {
  return useQuery({
    ...insightList(project),
    select: (items) => {
      const value = items.find((item) => item.id === id);
      if (!value) throw new Error("Insight not found");
      return value;
    },
  });
}
function useInsightMutation<T, R>(
  project: string,
  mutationFn: (input: T) => Promise<R>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => refreshProjectEntities(client, project, true),
  });
}
export function useCreateInsight(project: string) {
  return useInsightMutation(project, (data: UsableInsightInput) =>
    insightsApi.createInsight({ project, data }),
  );
}
export function useUpdateInsight(project: string) {
  return useInsightMutation(project, (insight: Insight) =>
    insightsApi.updateInsight({ project, insight }),
  );
}
export function useDeleteInsight(project: string) {
  return useInsightMutation(project, (insightId: number) =>
    insightsApi.deleteInsight({ project, insightId }),
  );
}
