import { InsightName } from "./insight-name";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { ChartBreakdownOptions } from "./common/chart-breakdown";
import { InsightTimeControls } from "@/components/insight-time-controls";

import { useUpdateInsight, useInsight } from "@/services/insights.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { Spinner } from "@/components/spinner.tsx";
import { Insight } from "@/model/insights/insight.ts";
import {
  BaseInsightContext,
  BreakdownInsightContext,
  FunnelInsightContext,
  MapInsightContext,
  PathInsightContext,
  RetentionInsightContext,
  TrendInsightContext,
  ValueInsightContext,
} from "@app/insights/insight-context";
import { TrendInsightView } from "@app/insights/trend/trend-insight-view.tsx";
import { useState } from "react";
import { TrendInsight } from "@/model/insights/trend-insight.ts";
import { ValueInsight } from "@/model/insights/value-insight.ts";
import { ValueInsightView } from "@app/insights/value/value-insight-view.tsx";
import { FunnelInsight } from "@/model/insights/funnel-insights.ts";
import { FunnelInsightView } from "@app/insights/funnel/funnel-insight-view.tsx";
import { BreakdownInsight } from "@/model/insights/breakdown-insight.ts";
import { BreakdownInsightView } from "@app/insights/breakdown/breakdown-insight-view.tsx";
import { RetentionInsight } from "@/model/insights/retention-insight.ts";
import { RetentionInsightView } from "@app/insights/retention/retention-insight-view.tsx";
import { PathInsight } from "@/model/insights/path-insight.ts";
import { PathInsightView } from "@app/insights/path/path-insight-view.tsx";
import { MapInsight } from "@/model/insights/map-insight.ts";
import { MapInsightView } from "@app/insights/map/map-insight-view.tsx";

interface Props {
  insightId: number;
  readOnly?: boolean;
  mode?: "view" | "edit";
}

export function InsightView({ insightId, readOnly, mode = "view" }: Props) {
  const projectId = useProjectId();

  return (
    <InsightEditor
      key={`${projectId}:${insightId}:${mode}`}
      insightId={insightId}
      mode={mode}
      readOnly={readOnly ?? false}
    />
  );
}

function timeframeConfig(insight: Insight) {
  switch (insight.type) {
    case "Trend":
      return insight.config.trend;
    case "Value":
      return insight.config.value;
    case "Funnel":
      return insight.config.funnel;
    case "Breakdown":
      return insight.config.breakdown;
    case "Retention":
      return insight.config.retention;
    case "Path":
      return insight.config.path;
    case "Map":
      return insight.config.map;
  }
}

function InsightEditor({ insightId, readOnly, mode }: Props) {
  const projectId = useProjectId();
  const insightData = useInsight(projectId, insightId);
  const updater = useUpdateInsight(projectId);
  const nameUpdater = useUpdateInsight(projectId);
  const navigate = useNavigate();
  const [viewCopy, setViewCopy] = useState<Insight>();
  const [editCopy, setEditCopy] = useState<Insight>();
  const editing = mode === "edit" && !readOnly;
  const localWorkingCopy = editing ? editCopy : viewCopy;
  const updateWorkingCopy = editing ? setEditCopy : setViewCopy;

  if (insightData.isLoading || insightData.isPending) return <Spinner />;
  if (insightData.error) return <div>Error: {insightData.error.message}</div>;

  const current = localWorkingCopy ?? insightData.data;
  const timeframeChanged =
    timeframeConfig(current).duration !==
    timeframeConfig(insightData.data).duration;
  const isChanged =
    editing && JSON.stringify(insightData.data) !== JSON.stringify(current);
  const showView = () =>
    navigate({
      to: "/app/$projectid/insights/$insightid",
      params: { projectid: projectId, insightid: String(insightId) },
      replace: true,
    });
  const save = () => {
    updater.mutate(current, { onSuccess: () => void showView() });
  };
  const changeDuration = (duration: string) => {
    const copy = structuredClone(current);
    timeframeConfig(copy).duration = duration;
    updateWorkingCopy(copy);
  };

  const renderInsight = (insight: Insight) => {
    switch (insight.type) {
      case "Trend":
        return (
          <TrendInsightContext.Provider
            value={{
              data: insight,
              update: updateWorkingCopy,
              updateFn: (fn: (i: TrendInsight) => void) => {
                const copy = structuredClone(insight);
                if (copy.type === "Trend") fn(copy);
                updateWorkingCopy(copy);
              },
            }}
          >
            <TrendInsightView />
          </TrendInsightContext.Provider>
        );
      case "Value":
        return (
          <ValueInsightContext.Provider
            value={{
              data: insight,
              update: updateWorkingCopy,
              updateFn: (fn: (i: ValueInsight) => void) => {
                const copy = structuredClone(insight);
                if (copy.type === "Value") fn(copy);
                updateWorkingCopy(copy);
              },
            }}
          >
            <ValueInsightView />
          </ValueInsightContext.Provider>
        );
      case "Funnel":
        return (
          <FunnelInsightContext.Provider
            value={{
              data: insight,
              update: updateWorkingCopy,
              updateFn: (fn: (i: FunnelInsight) => void) => {
                const copy = structuredClone(insight);
                if (copy.type === "Funnel") fn(copy);
                updateWorkingCopy(copy);
              },
            }}
          >
            <FunnelInsightView />
          </FunnelInsightContext.Provider>
        );
      case "Breakdown":
        return (
          <BreakdownInsightContext.Provider
            value={{
              data: insight,
              update: updateWorkingCopy,
              updateFn: (fn: (i: BreakdownInsight) => void) => {
                const copy = structuredClone(insight);
                if (copy.type === "Breakdown") fn(copy);
                updateWorkingCopy(copy);
              },
            }}
          >
            <BreakdownInsightView />
          </BreakdownInsightContext.Provider>
        );
      case "Retention":
        return (
          <RetentionInsightContext.Provider
            value={{
              data: insight,
              update: updateWorkingCopy,
              updateFn: (fn: (i: RetentionInsight) => void) => {
                const copy = structuredClone(insight);
                if (copy.type === "Retention") fn(copy);
                updateWorkingCopy(copy);
              },
            }}
          >
            <RetentionInsightView />
          </RetentionInsightContext.Provider>
        );
      case "Path":
        return (
          <PathInsightContext.Provider
            value={{
              data: insight,
              update: updateWorkingCopy,
              updateFn: (fn: (i: PathInsight) => void) => {
                const copy = structuredClone(insight);
                if (copy.type === "Path") fn(copy);
                updateWorkingCopy(copy);
              },
            }}
          >
            <PathInsightView />
          </PathInsightContext.Provider>
        );
      case "Map":
        return (
          <MapInsightContext.Provider
            value={{
              data: insight,
              update: updateWorkingCopy,
              updateFn: (fn: (i: MapInsight) => void) => {
                const copy = structuredClone(insight);
                if (copy.type === "Map") fn(copy);
                updateWorkingCopy(copy);
              },
            }}
          >
            <MapInsightView />
          </MapInsightContext.Provider>
        );
      default:
        return <div>Unknown insight type</div>;
    }
  };

  const chartControls = !readOnly && (
    <div
      aria-label="Chart controls"
      role="group"
      className="space-y-2 rounded-xl border border-border/50 bg-card p-4"
    >
      <InsightTimeControls
        duration={timeframeConfig(current).duration}
        timeBucket={
          current.type === "Trend" ? current.config.trend.timeBucket : undefined
        }
        onDurationChange={changeDuration}
        onBucketChange={
          current.type === "Trend"
            ? (bucket) => {
                const copy = structuredClone(current);
                copy.config.trend.timeBucket = bucket;
                updateWorkingCopy(copy);
              }
            : undefined
        }
      >
        {current.type === "Map" ? null : editing ? (
          <ChartBreakdownOptions
            insight={current}
            onChange={updateWorkingCopy}
          />
        ) : (
          <span className="text-sm text-muted-foreground">
            breakdown by{" "}
            <span className="font-medium text-foreground">
              {current.breakdownBy?.name ?? "None"}
            </span>
          </span>
        )}
      </InsightTimeControls>
      {(editing || timeframeChanged) && (
        <p className="text-xs text-muted-foreground">
          {editing
            ? "Save to use this timeframe as the insight’s default."
            : "Temporary timeframe. Edit to save as default."}
        </p>
      )}
    </div>
  );

  return (
    <>
      <BaseInsightContext.Provider
        value={{
          chartControls,
          isChanged,
          original: insightData.data,
          updateWorkingCopy,
          readOnly: !editing,
        }}
      >
        {!readOnly && (
          <div className="mb-2 flex min-w-0 flex-wrap items-center gap-4">
            <InsightName
              name={current.name}
              disabled={updater.isPending || nameUpdater.isPending}
              onRename={async (name) => {
                await nameUpdater.mutateAsync({ ...insightData.data, name });
                setViewCopy((copy) => (copy ? { ...copy, name } : copy));
                setEditCopy((copy) => (copy ? { ...copy, name } : copy));
              }}
            />
            <div className="flex-1" />
            {editing ? (
              <>
                <Button
                  disabled={
                    !isChanged || updater.isPending || nameUpdater.isPending
                  }
                  onClick={save}
                >
                  {updater.isPending ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="outline"
                  disabled={updater.isPending}
                  onClick={() => void showView()}
                >
                  Discard Changes
                </Button>
              </>
            ) : (
              <Button
                onClick={() =>
                  void navigate({
                    to: "/app/$projectid/insights/$insightid/edit",
                    params: {
                      projectid: projectId,
                      insightid: String(insightId),
                    },
                  })
                }
              >
                Edit
              </Button>
            )}
          </div>
        )}
        {updater.isError && (
          <p role="alert" className="text-sm text-destructive">
            Could not save changes. Please try again.
          </p>
        )}
        <fieldset disabled={updater.isPending} className="min-w-0 space-y-4">
          {renderInsight(current)}
        </fieldset>
      </BaseInsightContext.Provider>
    </>
  );
}
