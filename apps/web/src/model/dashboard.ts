export type Dashboard = import("zod").infer<
  typeof import("@quacklytics/contracts").dashboard
>;

export interface DashboardInput {
  name: string;
  favorite: boolean;
}

export type DashboardTemplate =
  | "web_analytics"
  | "product_analytics"
  | "chart_playground";

export interface DashboardTemplateInput {
  name?: string;
  home?: boolean;
}
