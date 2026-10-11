import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { useInsight } from "@/services/insights.ts";
import { Spinner } from "@/components/spinner.tsx";
import { Insight } from "@/model/insights/insight.ts";
import { TrendInsightChart } from "@app/insights/trend/trend-insight-chart.tsx";
import {
  BreakdownInsightContext,
  FunnelInsightContext,
  MapInsightContext,
  PathInsightContext,
  RetentionInsightContext,
  TrendInsightContext,
  ValueInsightContext,
} from "./insight-context";
import { ProjectLink } from "@/components/project-link.tsx";
import { ValueInsightChart } from "@app/insights/value/value-insight-chart.tsx";
import { FunnelInsightResults } from "@app/insights/funnel/funnel-insight-results.tsx";
import { BreakdownInsightChart } from "@app/insights/breakdown/breakdown-insight-chart.tsx";
import { RetentionInsightChart } from "@app/insights/retention/retention-insight-chart.tsx";
import { PathInsightChart } from "@app/insights/path/path-insight-chart.tsx";
import { MapInsightChart } from "@app/insights/map/map-insight-chart.tsx";

import type { TimeBucket } from "@/model/insights/trend-insight";
import { Clock } from "lucide-react";
import { determineLabel } from "@/model/insights/insight-date-range";

export interface InsightTimeOverrides {
  duration?: string;
  timeBucket?: TimeBucket;
}

interface Props {
  insightId: number;
  timeOverrides?: InsightTimeOverrides | undefined;
}

export function InsightCard({ insightId, timeOverrides }: Props) {
  const projectId = useProjectId();
  const insightData = useInsight(projectId, insightId);

  if (insightData.status === "pending")
    return emptyCard("Loading...", <Spinner />);
  if (insightData.status === "error")
    return emptyCard("Error", <div>Error: {insightData.error.message}</div>);

  const insight = structuredClone(insightData.data);
  if (timeOverrides?.duration) {
    switch (insight.type) {
      case "Trend":
        insight.config.trend.duration = timeOverrides.duration;
        break;
      case "Value":
        insight.config.value.duration = timeOverrides.duration;
        break;
      case "Funnel":
        insight.config.funnel.duration = timeOverrides.duration;
        break;
      case "Breakdown":
        insight.config.breakdown.duration = timeOverrides.duration;
        break;
      case "Retention":
        insight.config.retention.duration = timeOverrides.duration;
        break;
      case "Path":
        insight.config.path.duration = timeOverrides.duration;
        break;
      case "Map":
        insight.config.map.duration = timeOverrides.duration;
        break;
    }
  }
  if (timeOverrides?.timeBucket && insight.type === "Trend") {
    insight.config.trend.timeBucket = timeOverrides.timeBucket;
  }

  return (
    <Card className="h-full min-w-0 overflow-auto border border-border/50">
      <CardHeader className="mx-5 mb-5 flex-row items-center justify-between gap-3 space-y-0 border-b border-border/40 px-0 py-4">
        <CardTitle className="min-w-0 text-sm leading-snug">
          <ProjectLink to={`/insights/${insight.id}`}>
            {insight.name}
          </ProjectLink>
        </CardTitle>
        {!timeOverrides?.duration && !timeOverrides?.timeBucket && (
          <span
            aria-label="Insight timeframe"
            className="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Clock aria-hidden="true" className="h-3.5 w-3.5" />
            {determineLabel(insightDuration(insight))}
          </span>
        )}
      </CardHeader>
      <CardContent data-insight-content className="px-5 pb-5">
        {renderInsight(insight)}
      </CardContent>
    </Card>
  );
}

function insightDuration(insight: Insight) {
  switch (insight.type) {
    case "Trend":
      return insight.config.trend.duration;
    case "Value":
      return insight.config.value.duration;
    case "Funnel":
      return insight.config.funnel.duration;
    case "Breakdown":
      return insight.config.breakdown.duration;
    case "Retention":
      return insight.config.retention.duration;
    case "Path":
      return insight.config.path.duration;
    case "Map":
      return insight.config.map.duration;
  }
}

function renderInsight(insight: Insight) {
  switch (insight.type) {
    case "Trend":
      return (
        <TrendInsightContext.Provider
          value={{
            data: insight,
            update: () => undefined,
            updateFn: () => undefined,
          }}
        >
          <TrendInsightChart insight={insight} />
        </TrendInsightContext.Provider>
      );
    case "Value":
      return (
        <ValueInsightContext.Provider
          value={{
            data: insight,
            update: () => undefined,
            updateFn: () => undefined,
          }}
        >
          <ValueInsightChart insight={insight} />
        </ValueInsightContext.Provider>
      );
    case "Funnel":
      return (
        <FunnelInsightContext.Provider
          value={{
            data: insight,
            update: () => undefined,
            updateFn: () => undefined,
          }}
        >
          <FunnelInsightResults insight={insight} layoutDirection="vertical" />
        </FunnelInsightContext.Provider>
      );
    case "Breakdown":
      return (
        <BreakdownInsightContext.Provider
          value={{
            data: insight,
            update: () => undefined,
            updateFn: () => undefined,
          }}
        >
          <BreakdownInsightChart insight={insight} showTable={false} />
        </BreakdownInsightContext.Provider>
      );
    case "Retention":
      return (
        <RetentionInsightContext.Provider
          value={{
            data: insight,
            update: () => undefined,
            updateFn: () => undefined,
          }}
        >
          <RetentionInsightChart insight={insight} />
        </RetentionInsightContext.Provider>
      );
    case "Path":
      return (
        <PathInsightContext.Provider
          value={{
            data: insight,
            update: () => undefined,
            updateFn: () => undefined,
          }}
        >
          <PathInsightChart insight={insight} />
        </PathInsightContext.Provider>
      );
    case "Map":
      return (
        <MapInsightContext.Provider
          value={{
            data: insight,
            update: () => undefined,
            updateFn: () => undefined,
          }}
        >
          <MapInsightChart insight={insight} showTable={false} />
        </MapInsightContext.Provider>
      );
    default:
      return <div>Unknown insight type</div>;
  }
}

function emptyCard(title: string, children: React.ReactNode) {
  return (
    <Card className="h-full min-w-0 overflow-auto border border-border/50">
      <CardHeader className="mx-5 mb-5 border-b border-border/40 px-0 py-4">
        <CardTitle className="text-sm leading-snug">{title}</CardTitle>
      </CardHeader>
      <CardContent data-insight-content className="px-5 pb-5">
        {children}
      </CardContent>
    </Card>
  );
}
