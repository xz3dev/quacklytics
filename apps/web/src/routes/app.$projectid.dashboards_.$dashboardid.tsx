import { createFileRoute } from "@tanstack/react-router";
import { DashboardView } from "@/app/dashboards/dashboard-view";
export const Route = createFileRoute(
  "/app/$projectid/dashboards_/$dashboardid",
)({ ssr: false, component: Page });
function Page() {
  return <DashboardView dashboardId={Number(Route.useParams().dashboardid)} />;
}
