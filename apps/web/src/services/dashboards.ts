import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardsApi } from "@/client/api/dashboards";
import { dashboardList } from "@/data/dashboards";
import { refreshProjectEntities } from "@/data/synchronize";
import type {
  Dashboard,
  DashboardInput,
  DashboardTemplate,
  DashboardTemplateInput,
} from "@/model/dashboard";
import type { DashboardGridItem } from "@quacklytics/contracts";

export function useDashboards(project: string) {
  return useQuery(dashboardList(project));
}
export function useDashboard(project: string, id: number) {
  return useQuery({
    ...dashboardList(project),
    select: (items) => {
      const value = items.find((item) => item.id === id);
      if (!value) throw new Error("Dashboard not found");
      return value;
    },
  });
}
function useDashboardMutation<T, R>(
  project: string,
  mutationFn: (input: T) => Promise<R>,
  insightsChanged = false,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => refreshProjectEntities(client, project, insightsChanged),
  });
}
export function useCreateDashboard(project: string) {
  return useDashboardMutation(project, (data: DashboardInput) =>
    dashboardsApi.createDashboard({ project, data }),
  );
}
export function useDeleteDashboard(project: string) {
  return useDashboardMutation(project, (dashboardId: number) =>
    dashboardsApi.deleteDashboard({ project, dashboardId }),
  );
}
export function useRestoreDefaultDashboard(project: string) {
  return useDashboardMutation(
    project,
    () => dashboardsApi.restoreDefaultDashboard(project),
    true,
  );
}
export function useCreateTemplateDashboard(project: string) {
  return useDashboardMutation(
    project,
    (params: { template: DashboardTemplate; data?: DashboardTemplateInput }) =>
      dashboardsApi.createTemplateDashboard({ project, ...params }),
    true,
  );
}
export function useApplyDashboardTemplate(project: string) {
  return useDashboardMutation(
    project,
    (params: { dashboardId: number; template: DashboardTemplate }) =>
      dashboardsApi.applyTemplateToDashboard({ project, ...params }),
    true,
  );
}
export function useUpdateDashboard(project: string) {
  return useDashboardMutation(project, (dashboard: Dashboard) =>
    dashboardsApi.updateDashboard({ project, dashboard }),
  );
}
export function useSetDashboardInsights(project: string) {
  return useDashboardMutation(
    project,
    (params: { dashboardId: number; insightIds: number[] }) =>
      dashboardsApi.setDashboardInsights({ project, ...params }),
  );
}
export function useSetHomeDashboard(project: string) {
  return useDashboardMutation(project, (dashboardId: number) =>
    dashboardsApi.setHomeDashboard({ project, dashboardId }),
  );
}
export function useSetDashboardLayout(project: string) {
  return useDashboardMutation(
    project,
    ({
      dashboardId,
      layout,
    }: {
      dashboardId: number;
      layout: DashboardGridItem[];
    }) => dashboardsApi.setDashboardLayout(project, dashboardId, layout),
  );
}
