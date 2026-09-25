import {
  useApplyDashboardTemplate,
  useDashboard,
  useSetDashboardInsights,
  useUpdateDashboard,
} from "@/services/dashboards";
import { useProjectId } from "@/hooks/use-project-id";
import { Spinner } from "@/components/spinner";
import { DashboardManageInsights } from "@app/dashboards/dashboard-manage-insights";
import { DndContext, DragEndEvent } from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import { SortableInsightCard } from "./sortable-insight-card";
import { useEffect, useState } from "react";
import { Insight } from "@/model/insights/insight.ts";
import { useDebounce } from "@uidotdev/usehooks";
import { ProjectLink } from "@/components/project-link";
import { Button } from "@/components/ui/button.tsx";
import { BarChart3, Boxes, Edit, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { DashboardTemplate } from "@/model/dashboard";
import { Input } from "@/components/ui/input";

interface Props {
  dashboardId: number;
  readOnly?: boolean;
}

export function DashboardView({ dashboardId, readOnly }: Props) {
  const projectId = useProjectId();
  const {
    data: dashboard,
    isLoading,
    error,
  } = useDashboard(projectId, dashboardId);
  const [insights, setInsights] = useState<Insight[]>([]);
  const debouncedInsights = useDebounce(insights, 1000);
  const setDashboardInsights = useSetDashboardInsights(projectId);
  const updateDashboard = useUpdateDashboard(projectId);
  const applyDashboardTemplate = useApplyDashboardTemplate(projectId);

  const [dashboardName, setDashboardName] = useState(dashboard?.name ?? "");
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    setDashboardName(dashboard?.name ?? "");
  }, [dashboard]);

  useEffect(() => {
    setInsights(dashboard?.insights ?? []);
  }, [dashboard]);

  useEffect(() => {
    if (!dashboard || !debouncedInsights.length) return;
    void setDashboardInsights.mutateAsync({
      dashboardId: dashboard.id,
      insightIds: debouncedInsights.map((i) => i.id),
    });
  }, [debouncedInsights]);

  if (isLoading) return <Spinner />;
  if (error) return <div>Error: {error.message}</div>;
  if (!dashboard) return null;

  const handleNameChange = (name: string) => {
    const newDashboard = { ...dashboard, name };
    void updateDashboard.mutateAsync(newDashboard);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      setInsights((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const applyTemplate = async (template: DashboardTemplate) => {
    await applyDashboardTemplate.mutateAsync({
      dashboardId: dashboard.id,
      template,
    });
  };

  return (
    <div className="flex flex-col gap-4 my-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">
          <ProjectLink to={`/dashboards/${dashboard.id}`}>
            {dashboard.name}
          </ProjectLink>

          <Dialog open={isEditingName} onOpenChange={setIsEditingName}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full ml-1">
                <Edit className="w-5 h-5 text-muted-foreground" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename Dashboard</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <Input
                  defaultValue={dashboardName}
                  onChange={(e) => setDashboardName(e.target.value)}
                  placeholder="Enter dashboard name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleNameChange(dashboardName);
                      setIsEditingName(false);
                    }
                  }}
                />
                <div className="flex flex-row gap-2 items-center">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDashboardName(dashboard.name);
                      setIsEditingName(false);
                    }}
                  >
                    Cancel
                  </Button>

                  <Button
                    onClick={() => {
                      handleNameChange(dashboardName);
                      setIsEditingName(false);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </h1>
        <div className="flex-1" />
        {!readOnly && <DashboardManageInsights dashboard={dashboard} />}
      </div>
      {!readOnly && insights.length === 0 ? (
        <div className="grid gap-3 rounded-md bg-muted p-4 md:grid-cols-3">
          <ProjectLink to="/insights">
            <Button
              variant="outline"
              className="h-auto min-h-24 w-full justify-start gap-3 p-4"
            >
              <Plus className="h-4 w-4" />
              <span>Add an insight manually</span>
            </Button>
          </ProjectLink>
          <Button
            variant="outline"
            className="h-auto min-h-24 justify-start gap-3 p-4"
            onClick={() => applyTemplate("product_analytics")}
            disabled={applyDashboardTemplate.isPending}
          >
            <Boxes className="h-4 w-4" />
            Apply product analytics template
          </Button>
          <Button
            variant="outline"
            className="h-auto min-h-24 justify-start gap-3 p-4"
            onClick={() => applyTemplate("web_analytics")}
            disabled={applyDashboardTemplate.isPending}
          >
            <BarChart3 className="h-4 w-4" />
            Apply web analytics template
          </Button>
          {import.meta.env.DEV && (
            <Button
              variant="outline"
              onClick={() => applyTemplate("chart_playground")}
              disabled={applyDashboardTemplate.isPending}
            >
              Apply chart playground (dev)
            </Button>
          )}
        </div>
      ) : (
        <DndContext onDragEnd={handleDragEnd}>
          <SortableContext items={insights} strategy={rectSortingStrategy}>
            <div className="grid gap-4 py-4 grid-cols-1 md:grid-cols-2 items-stretch">
              {insights.map((insight) => (
                <SortableInsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
