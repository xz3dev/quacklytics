import { useInsight } from "@/services/insights.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { Spinner } from "@/components/spinner.tsx";
import { Insight } from "@/model/insights/insight.ts";
import {
  BaseInsightContext,
  BreakdownInsightContext,
  FunnelInsightContext,
  PathInsightContext,
  RetentionInsightContext,
  TrendInsightContext,
  ValueInsightContext,
} from "@app/insights/insight-context";
import { TrendInsightView } from "@app/insights/trend/trend-insight-view.tsx";
import { useEffect, useState } from "react";
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

interface Props {
  insightId: number;
  readOnly?: boolean;
}

export function InsightView({ insightId, readOnly }: Props) {
  const projectId = useProjectId();

  const insightData = useInsight(projectId, insightId);
  const [localWorkingCopy, updateWorkingCopy] = useState(insightData.data);

  useEffect(() => {
    if (insightData.data && !localWorkingCopy) {
      updateWorkingCopy(insightData.data);
    }
  }, [insightData.data]);

  if (insightData.isLoading || insightData.isPending) return <Spinner />;
  if (insightData.error) return <div>Error: {insightData.error.message}</div>;

  const isChanged =
    JSON.stringify(insightData.data) !== JSON.stringify(localWorkingCopy);

  const renderInsight = (insight: Insight) => {
    switch (insight.type) {
      case "Trend":
        return (
          <TrendInsightContext.Provider
            value={{
              data: insight,
              update: updateWorkingCopy,
              updateFn: (fn: (i: TrendInsight) => void) => {
                if (!localWorkingCopy) return;
                const copy = structuredClone(localWorkingCopy);
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
                if (!localWorkingCopy) return;
                const copy = structuredClone(localWorkingCopy);
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
                if (!localWorkingCopy) return;
                const copy = structuredClone(localWorkingCopy);
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
                if (!localWorkingCopy) return;
                const copy = structuredClone(localWorkingCopy);
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
                if (!localWorkingCopy) return;
                const copy = structuredClone(localWorkingCopy);
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
                if (!localWorkingCopy) return;
                const copy = structuredClone(localWorkingCopy);
                if (copy.type === "Path") fn(copy);
                updateWorkingCopy(copy);
              },
            }}
          >
            <PathInsightView />
          </PathInsightContext.Provider>
        );
      default:
        return <div>Unknown insight type</div>;
    }
  };

  return (
    <>
      <BaseInsightContext.Provider
        value={{
          isChanged,
          original: insightData.data,
          updateWorkingCopy,
          readOnly: readOnly ?? false,
        }}
      >
        {renderInsight(localWorkingCopy ?? insightData.data)}
      </BaseInsightContext.Provider>
    </>
  );
}
