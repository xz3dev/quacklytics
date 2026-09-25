import { InsightsList } from "../insights/insight-list";
import { DashboardView } from "@app/dashboards/dashboard-view.tsx";
import {
  useCreateTemplateDashboard,
  useDashboards,
} from "@/services/dashboards.ts";
import { Spinner } from "@/components/spinner.tsx";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { Button } from "@/components/ui/button.tsx";
import { BarChart3, Boxes, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { ProjectLink } from "@/components/project-link.tsx";

export function Home() {
  const projectId = useProjectId();
  const dashboardsQuery = useDashboards(projectId);
  const createTemplateDashboard = useCreateTemplateDashboard(projectId);
  const blankSetupKey = `analytics-dashboard-setup-blank:${projectId}`;
  const [blankSetup, setBlankSetup] = useState(
    () => window.localStorage.getItem(blankSetupKey) === "true",
  );

  useEffect(() => {
    setBlankSetup(window.localStorage.getItem(blankSetupKey) === "true");
  }, [blankSetupKey]);

  if (dashboardsQuery.isLoading || dashboardsQuery.isPending)
    return <Spinner />;
  if (dashboardsQuery.error)
    return <div>Error: {dashboardsQuery.error.message}</div>;
  if (dashboardsQuery.data.length === 0 && !blankSetup) {
    const startTemplate = async (
      template: "product_analytics" | "web_analytics",
    ) => {
      await createTemplateDashboard.mutateAsync({
        template,
        data: { home: true },
      });
    };
    const startBlank = () => {
      window.localStorage.setItem(blankSetupKey, "true");
      setBlankSetup(true);
    };

    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-8">
        <div>
          <h1 className="text-2xl font-bold">Start analytics</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose the dashboard template that matches the data you want to
            inspect first.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <button
            className="flex min-h-40 flex-col items-start gap-3 rounded-xl bg-card p-5 text-left transition-colors hover:bg-muted/50"
            onClick={() => startTemplate("product_analytics")}
            disabled={createTemplateDashboard.isPending}
          >
            <Boxes className="h-5 w-5 text-muted-foreground" />
            <span className="text-base font-semibold">
              Start with product analytics
            </span>
            <span className="text-sm text-muted-foreground">
              Activation, engagement, retention, feature adoption, and app
              journeys.
            </span>
          </button>
          <button
            className="flex min-h-40 flex-col items-start gap-3 rounded-xl bg-card p-5 text-left transition-colors hover:bg-muted/50"
            onClick={() => startTemplate("web_analytics")}
            disabled={createTemplateDashboard.isPending}
          >
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <span className="text-base font-semibold">
              Start with web analytics
            </span>
            <span className="text-sm text-muted-foreground">
              Visitors, pages, devices, browsers, referrers, retention, and page
              journeys.
            </span>
          </button>
          <button
            className="flex min-h-40 flex-col items-start gap-3 rounded-xl bg-card p-5 text-left transition-colors hover:bg-muted/50"
            onClick={startBlank}
          >
            <Plus className="h-5 w-5 text-muted-foreground" />
            <span className="text-base font-semibold">Start blank</span>
            <span className="text-sm text-muted-foreground">
              Create dashboards and insights manually.
            </span>
          </button>
        </div>
      </div>
    );
  }
  const home = dashboardsQuery.data.find((d) => d.home)?.id;
  return (
    <div className="flex flex-col gap-4">
      <InsightsList
        title={"Favorite Insights"}
        filter={(i) => i.favorite}
        createAsFavorite={true}
      />
      {home && <DashboardView dashboardId={home} readOnly={true} />}
      {!home && (
        <Button asChild variant="outline" className="w-fit">
          <ProjectLink to="/dashboards">Create a dashboard</ProjectLink>
        </Button>
      )}
    </div>
  );
}
