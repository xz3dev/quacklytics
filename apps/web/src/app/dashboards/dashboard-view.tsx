import {
  useApplyDashboardTemplate,
  useDashboard,
  useSetDashboardLayout,
  useUpdateDashboard,
} from "@/services/dashboards";
import { useProjectId } from "@/hooks/use-project-id";
import { Spinner } from "@/components/spinner";
import { DashboardManageInsights } from "@app/dashboards/dashboard-manage-insights";
import { useRef, useState } from "react";
import { DashboardGrid } from "./dashboard-grid";
import {
  resolveDashboardLayout,
  type DashboardGridItem,
} from "@quacklytics/contracts";
import { ProjectLink } from "@/components/project-link";
import { Button } from "@/components/ui/button.tsx";
import { BarChart3, Boxes, Edit, Plus } from "lucide-react";
import type { DashboardTemplate } from "@/model/dashboard";
import { Input } from "@/components/ui/input";

import { InsightTimeControls } from "@/components/insight-time-controls";
import type { InsightTimeOverrides } from "@/app/insights/insight-card";

interface Props {
  dashboardId: number;
  readOnly?: boolean;
  presentation?: "cards";
}

export function DashboardView(props: Props) {
  const projectId = useProjectId();
  return (
    <DashboardContent key={`${projectId}-${props.dashboardId}`} {...props} />
  );
}

function DashboardContent({ dashboardId, readOnly, presentation }: Props) {
  const [timeOverrides, setTimeOverrides] = useState<InsightTimeOverrides>({});
  const [showTimeOverrides, setShowTimeOverrides] = useState(false);
  const projectId = useProjectId();
  const {
    data: dashboard,
    isLoading,
    error,
  } = useDashboard(projectId, dashboardId);
  const [layoutDraft, setLayoutDraft] = useState<DashboardGridItem[] | null>(
    null,
  );
  const setDashboardLayout = useSetDashboardLayout(projectId);
  const insights = dashboard?.insights ?? [];
  const savedLayout = resolveDashboardLayout(
    insights.map((item) => item.id),
    dashboard?.layout,
  );
  const editing = !readOnly && layoutDraft !== null;
  const updateDashboard = useUpdateDashboard(projectId);
  const applyDashboardTemplate = useApplyDashboardTemplate(projectId);

  const [dashboardName, setDashboardName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const nameEditActive = useRef(false);
  const renameButton = useRef<HTMLButtonElement>(null);

  if (isLoading) return <Spinner />;
  if (error) return <div>Error: {error.message}</div>;
  if (!dashboard) return null;

  const saveName = () => {
    if (!nameEditActive.current) return;
    nameEditActive.current = false;
    setIsEditingName(false);
    const name = dashboardName.trim();
    if (!name || name === dashboard.name) return;
    updateDashboard.mutate(
      { ...dashboard, name },
      {
        onError: () => {
          nameEditActive.current = true;
          setIsEditingName(true);
        },
      },
    );
  };

  const applyTemplate = async (template: DashboardTemplate) => {
    await applyDashboardTemplate.mutateAsync({
      dashboardId: dashboard.id,
      template,
    });
  };

  return (
    <div
      className={
        presentation === "cards"
          ? "analytics-overview flex flex-col gap-5"
          : "flex min-w-0 flex-col gap-4"
      }
    >
      <div
        className={
          presentation === "cards"
            ? "flex flex-col gap-4"
            : "mb-4 flex flex-col gap-4"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 max-w-full">
            {isEditingName ? (
              <Input
                autoFocus
                aria-label="Dashboard name"
                value={dashboardName}
                className="h-10 text-2xl font-bold md:text-2xl"
                onFocus={(event) => event.target.select()}
                onChange={(event) => setDashboardName(event.target.value)}
                onBlur={saveName}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    nameEditActive.current = false;
                    setIsEditingName(false);
                    updateDashboard.reset();
                    requestAnimationFrame(() => renameButton.current?.focus());
                  } else if (
                    event.key === "Enter" &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <h1 aria-label={dashboard.name} className="text-2xl font-bold">
                {readOnly ? (
                  <ProjectLink to={`/dashboards/${dashboard.id}`}>
                    {dashboard.name}
                  </ProjectLink>
                ) : (
                  <button
                    ref={renameButton}
                    type="button"
                    aria-label="Rename dashboard"
                    disabled={updateDashboard.isPending}
                    className="inline-flex min-h-10 max-w-full items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      setDashboardName(dashboard.name);
                      updateDashboard.reset();
                      nameEditActive.current = true;
                      setIsEditingName(true);
                    }}
                  >
                    <span className="min-w-0 break-words">
                      {dashboard.name}
                    </span>
                    <Edit
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 text-muted-foreground"
                    />
                  </button>
                )}
              </h1>
            )}
            {updateDashboard.isError && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                Could not rename dashboard. Edit the name and leave the field to
                retry.
              </p>
            )}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <Button
                    variant="outline"
                    disabled={setDashboardLayout.isPending}
                    onClick={() => {
                      setLayoutDraft(null);
                      setDashboardLayout.reset();
                    }}
                  >
                    Discard changes
                  </Button>
                  <Button
                    disabled={setDashboardLayout.isPending}
                    onClick={async () => {
                      if (!layoutDraft) return;
                      try {
                        await setDashboardLayout.mutateAsync({
                          dashboardId,
                          layout: layoutDraft,
                        });
                        setLayoutDraft(null);
                      } catch {
                        /* Keep the draft available to retry. */
                      }
                    }}
                  >
                    {setDashboardLayout.isPending
                      ? "Saving layout…"
                      : "Save layout"}
                  </Button>
                </>
              ) : (
                <>
                  {insights.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setDashboardLayout.reset();
                        setLayoutDraft(savedLayout);
                      }}
                    >
                      Adjust layout
                    </Button>
                  )}
                  <DashboardManageInsights dashboard={dashboard} />
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {showTimeOverrides ? (
            <>
              <InsightTimeControls
                {...timeOverrides}
                onDurationChange={(duration) =>
                  setTimeOverrides((current) => ({ ...current, duration }))
                }
                onBucketChange={(timeBucket) =>
                  setTimeOverrides((current) => ({ ...current, timeBucket }))
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTimeOverrides({});
                  setShowTimeOverrides(false);
                }}
              >
                {timeOverrides.duration || timeOverrides.timeBucket
                  ? "Reset overrides"
                  : "Cancel"}
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">
                Using each insight’s timeframe and grouping.
              </span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => setShowTimeOverrides(true)}
              >
                Adjust
              </Button>
            </>
          )}
        </div>
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
        <div className="flex min-w-0 flex-col gap-3">
          {editing && (
            <p className="text-sm text-muted-foreground">
              Drag anywhere on an insight to move it or a border to resize it.
            </p>
          )}
          {editing && setDashboardLayout.isError && (
            <p role="alert" className="text-sm text-destructive">
              Could not save layout. {setDashboardLayout.error.message}
            </p>
          )}
          <DashboardGrid
            insights={insights}
            layout={editing && layoutDraft ? layoutDraft : savedLayout}
            editing={editing && !setDashboardLayout.isPending}
            onChange={setLayoutDraft}
            timeOverrides={timeOverrides}
          />
        </div>
      )}
    </div>
  );
}
