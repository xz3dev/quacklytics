import { insightsApi } from "@/client/api/insights";
export const insightList = (project: string) => ({
  queryKey: ["insights", project] as const,
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    insightsApi.getInsights(project, signal),
  staleTime: 5 * 60 * 1000,
});
