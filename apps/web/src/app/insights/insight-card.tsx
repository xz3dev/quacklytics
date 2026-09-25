import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { useInsight } from "@/services/insights.ts";
import { Spinner } from "@/components/spinner.tsx";
import { Insight } from "@/model/insights/insight.ts";
import { TrendInsightChart } from "@app/insights/trend/trend-insight-chart.tsx";
import {
  BreakdownInsightContext,
  FunnelInsightContext,
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

interface Props {
  insightId: number;
}

export function InsightCard({ insightId }: Props) {
  const projectId = useProjectId();
  const insightData = useInsight(projectId, insightId);

  if (insightData.status === "pending")
    return emptyCard("Loading...", <Spinner />);
  if (insightData.status === "error")
    return emptyCard("Error", <div>Error: {insightData.error.message}</div>);

  const insight = insightData.data;

  return (
    <Card className="h-full min-w-0 border border-border/30 shadow-sm">
      <CardHeader className="mx-5 mb-5 border-b border-border/40 px-0 py-4">
        <CardTitle className="text-sm leading-snug">
          <ProjectLink to={`/insights/${insight.id}`}>
            {insight.name}
          </ProjectLink>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">{renderInsight(insight)}</CardContent>
    </Card>
  );
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
    default:
      return <div>Unknown insight type</div>;
  }
}

function emptyCard(title: string, children: React.ReactNode) {
  return (
    <Card className="h-full min-w-0 border border-border/30 shadow-sm">
      <CardHeader className="mx-5 mb-5 border-b border-border/40 px-0 py-4">
        <CardTitle className="text-sm leading-snug">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">{children}</CardContent>
    </Card>
  );
}
