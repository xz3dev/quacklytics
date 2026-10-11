import {
  dashboard as dashboardSchema,
  dashboardCreate,
  dashboardUpdate,
} from "@quacklytics/contracts";
import type {
  Dashboard,
  DashboardInput,
  DashboardTemplate,
  DashboardTemplateInput,
} from "@/model/dashboard";
import { http } from "./http";
export const dashboardsApi = {
  getDashboards: async (
    project: string,
    signal?: AbortSignal,
  ): Promise<Dashboard[]> => {
    return http.get(`${project}/dashboards`, dashboardSchema.array(), signal);
  },

  createDashboard: async (params: {
    project: string;
    data: DashboardInput;
  }): Promise<Dashboard> => {
    return http.post(
      `${params.project}/dashboards`,
      dashboardCreate.parse(params.data),
      dashboardSchema,
    );
  },

  restoreDefaultDashboard: async (project: string): Promise<Dashboard> => {
    return http.post(
      `${project}/dashboards/default`,
      undefined,
      dashboardSchema,
    );
  },

  createTemplateDashboard: async (params: {
    project: string;
    template: DashboardTemplate;
    data?: DashboardTemplateInput;
  }): Promise<Dashboard> => {
    return http.post(
      `${params.project}/dashboards/templates/${params.template}`,
      params.data ?? {},
      dashboardSchema,
    );
  },

  applyTemplateToDashboard: async (params: {
    project: string;
    dashboardId: number;
    template: DashboardTemplate;
  }): Promise<Dashboard> => {
    return http.post(
      `${params.project}/dashboards/${params.dashboardId}/templates/${params.template}`,
      {},
      dashboardSchema,
    );
  },

  deleteDashboard: async (params: {
    project: string;
    dashboardId: number;
  }): Promise<void> => {
    await http.del(`${params.project}/dashboards/${params.dashboardId}`);
  },

  updateDashboard: async (params: {
    project: string;
    dashboard: Dashboard;
  }): Promise<Dashboard> => {
    return http.put(
      `${params.project}/dashboards/${params.dashboard.id}`,
      dashboardUpdate.parse(params.dashboard),
      dashboardSchema,
    );
  },

  setDashboardInsights: async (params: {
    project: string;
    dashboardId: number;
    insightIds: number[];
  }): Promise<Dashboard> => {
    return http.put(
      `${params.project}/dashboards/${params.dashboardId}/insights`,
      { insight_ids: params.insightIds },
      dashboardSchema,
    );
  },

  setHomeDashboard: async (params: {
    project: string;
    dashboardId: number;
  }): Promise<Dashboard> => {
    return http.put(
      `${params.project}/dashboards/${params.dashboardId}/home`,
      undefined,
      dashboardSchema,
    );
  },
  setDashboardLayout: (
    project: string,
    dashboardId: number,
    layout: import("@quacklytics/contracts").DashboardGridItem[],
  ) =>
    http.put(
      `${project}/dashboards/${dashboardId}/layout`,
      { layout },
      dashboardSchema,
    ),
};
