import { dashboardsApi } from "@/client/api/dashboards";
export const dashboardList = (project: string) => ({
  queryKey: ["dashboards", project] as const,
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    dashboardsApi.getDashboards(project, signal),
  staleTime: 5 * 60 * 1000,
});
