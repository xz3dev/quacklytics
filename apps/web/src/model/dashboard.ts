import type { z } from "zod";
import type {
  dashboard,
  dashboardCreate,
  dashboardTemplate,
  dashboardTemplateInput,
} from "@quacklytics/contracts";
export type Dashboard = z.infer<typeof dashboard>;
export type DashboardInput = z.input<typeof dashboardCreate>;
export type DashboardTemplate = z.infer<typeof dashboardTemplate>;
export type DashboardTemplateInput = z.infer<typeof dashboardTemplateInput>;
