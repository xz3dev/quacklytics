import { ChartEmptyState } from "@/components/chart-empty-state";
import { insightMetricUnit } from "@/lib/metric-value";
import { useChartBreakdown, breakdownLabel } from "@/lib/chart-breakdown";
import { ChartBreakdown } from "@/app/insights/common/chart-breakdown";
import { pathRow } from "@quacklytics/contracts";
import { AnalyticsChart } from "@/components/analytics-chart";
import { PathInsight } from "@/model/insights/path-insight.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { useMemo } from "react";
import { buildPathQuery } from "@lib/insight-queries.ts";
import { simpleHash } from "@lib/checksums.ts";
import { useDuckDBQuery } from "@/services/duck-db-queries.ts";
import { Spinner } from "@/components/spinner.tsx";
import { MoveRight } from "lucide-react";

interface Props {
  insight: PathInsight;
}

function UngroupedPathInsightChart({ insight }: Props) {
  const breakdown = useChartBreakdown();
  const projectId = useProjectId();
  const query = useMemo(
    () => ({
      query: buildPathQuery(insight.config.path),
      hash: simpleHash(JSON.stringify(insight.config.path)),
    }),
    [insight],
  );
  const result = useDuckDBQuery(projectId, `path-${query.hash}`, query.query);

  if (result.isPending || result.isLoading) return <Spinner />;
  if (result.error)
    return (
      <div className="text-sm text-red-600">Error: {result.error.message}</div>
    );

  const rows = (result.data ?? []).map((raw) => ({
    ...pathRow.parse(raw),
    groupIndex: Number(raw.__breakdown_index),
  }));
  if (rows.length === 0) return <ChartEmptyState insight={insight} />;

  const maxValue = Math.max(...rows.map((row) => Number(row.result_value)));
  // The query groups by source, destination, and distance. Preserve all three
  // in the chart category when a path visits the same destination repeatedly.
  const points = rows.map((row) => ({
    label: `${row.source_step} → ${row.target_step} · ${row.step_distance} ${row.step_distance === 1 ? "step" : "steps"} ${insight.config.path.direction === "backward" ? "before" : "after"}`,
    value: row.result_value,
    groupIndex: row.groupIndex,
  }));
  return (
    <div className="space-y-3">
      <AnalyticsChart
        metricUnit={insightMetricUnit(insight)}
        points={points}
        {...(breakdown
          ? {
              series: breakdown.values.map((value, index) => ({
                name: breakdownLabel(value),
                points: points.filter((point) => point.groupIndex === index),
              })),
            }
          : {})}
        label={insight.name ?? "Paths"}
      />
      {rows.map((row) => {
        const value = Number(row.result_value);
        const distance = Number(row.step_distance);
        const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
        return (
          <div
            key={JSON.stringify([
              row.groupIndex,
              row.source_step,
              row.target_step,
              distance,
            ])}
            className="space-y-1"
          >
            <div className="flex items-center gap-2 text-sm">
              <span
                className="max-w-[45%] truncate font-medium"
                title={row.source_step}
              >
                {row.source_step}
              </span>
              {breakdown && (
                <span>
                  {breakdownLabel(breakdown.values[row.groupIndex] ?? null)}
                </span>
              )}
              <MoveRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span
                className="max-w-[45%] truncate font-medium"
                title={row.target_step}
              >
                {row.target_step}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {distance} {distance === 1 ? "step" : "steps"}{" "}
                {insight.config.path.direction === "backward"
                  ? "before"
                  : "after"}
              </span>
              <span className="ml-auto tabular-nums text-muted-foreground">
                {value}
              </span>
            </div>
            <div className="h-2 rounded-sm bg-muted">
              <div
                className="h-2 rounded-sm bg-chart-1"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PathInsightChart(
  props: Parameters<typeof UngroupedPathInsightChart>[0],
) {
  return (
    <ChartBreakdown insight={props.insight}>
      <UngroupedPathInsightChart {...props} />
    </ChartBreakdown>
  );
}
