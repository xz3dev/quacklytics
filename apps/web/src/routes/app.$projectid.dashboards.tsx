import { createFileRoute } from "@tanstack/react-router";
import { DashboardList } from "@/app/dashboards/dashboard-list";
export const Route = createFileRoute("/app/$projectid/dashboards")({
  ssr: false,
  component: DashboardList,
});
