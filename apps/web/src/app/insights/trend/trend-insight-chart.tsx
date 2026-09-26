import { formatMetricValue, insightMetricUnit } from "@/lib/metric-value";
import {
  useChartBreakdown,
  breakdownLabel,
  breakdownColor,
} from "@/lib/chart-breakdown";
import { ChartSpace } from "@/components/chart-space";
import { ChartBreakdown } from "@/app/insights/common/chart-breakdown";
import { trendRow } from "@quacklytics/contracts";
import { useDuckDBQueries } from "@/services/duck-db-queries";
import type { TrendInsight } from "@/model/insights/trend-insight";
import { useProjectId } from "@/hooks/use-project-id";
import { buildQuery, mergeQueries } from "@/lib/trend-queries";
import { buildGroupByFilter, buildRangeFilters } from "@/model/filters";
import { Chart } from "@tanstack/charts/react";
import { defineChart, lineY, barY, group } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import {
  chartTooltip,
  nearbyChartFocus,
  formatTooltipDate,
  chartAxis,
  chartTheme,
  chartValueScale,
  formatChartDate,
} from "@/components/chart-style";
function UngroupedTrendInsightChart({ insight }: { insight: TrendInsight }) {
  const project = useProjectId();
  const breakdown = useChartBreakdown();
  const config = insight.config.trend;
  const series = config.series ?? [];
  const results = useDuckDBQueries(
    project,
    series.map((s, i) => ({
      uniqId: `trend-${insight.id}-${i}`,
      query: buildQuery(
        mergeQueries(s.query ?? {}, {
          filters: buildRangeFilters(config.duration),
          ...buildGroupByFilter(config.timeBucket, config.duration),
        }),
      ),
    })),
  );
  const chartSeries = series.flatMap((s, i) =>
    (breakdown?.values ?? [null]).map((value, groupIndex) => ({
      ...s,
      metricUnit: insightMetricUnit(insight, i),
      name: `${s.name?.trim() || `Series ${i + 1}`}${breakdown ? ` · ${breakdownLabel(value)}` : ""}`,
      color: breakdown
        ? breakdownColor(i * breakdown.values.length + groupIndex)
        : `hsl(var(--chart-${(i % 5) + 1}))`,
      rows: trendRow
        .array()
        .parse(
          (results[i]?.data ?? []).filter(
            (row) => !breakdown || Number(row.__breakdown_index) === groupIndex,
          ),
        )
        .map((r) => ({ date: r.trend_bucket, value: r.result_value })),
    })),
  );
  const barSeries = chartSeries.flatMap((s, i) =>
    s.visualisation === "bar" ? [i] : [],
  );
  const marks = chartSeries.map((s, i) => {
    const { rows, color } = s;
    return s.visualisation === "bar"
      ? barY(rows, {
          x: "date",
          y: "value",
          z: () => i,
          layout: group({
            // Share fixed slots across marks, even when a series has no rows.
            scale: scaleBand<number>().domain(barSeries).padding(0.15),
          }),
          fill: color,
          radius: 4,
          maxThickness: 28,
        })
      : lineY(rows, { x: "date", y: "value", stroke: color, strokeWidth: 2 });
  });
  if (results.some((r) => r.isPending)) return <p>Loading chart…</p>;
  const error = results.find((r) => r.error)?.error;
  if (error) return <p role="alert">{error.message}</p>;
  return (
    <div className="min-w-0 space-y-4">
      <ChartSpace minimum={240}>
        {(height) => (
          <Chart
            definition={defineChart({
              marks,
              theme: chartTheme,
              margin: { top: 12, right: 18 },
              scales: {
                x: {
                  scale: () => scaleBand().padding(0.3),
                  axis: {
                    ...chartAxis,
                    ticks: {
                      ...chartAxis.ticks,
                      spacing: config.timeBucket === "Hourly" ? 110 : 80,
                      format: (value) =>
                        formatChartDate(value, config.timeBucket === "Hourly"),
                    },
                  },
                },
                y: chartValueScale,
              },
              focus: nearbyChartFocus,
              maxFocusDistance: Number.POSITIVE_INFINITY,
              tooltip: {
                ...chartTooltip,
                content: (points) => {
                  const date = points[0]?.datum.date;
                  return {
                    title: date
                      ? formatTooltipDate(date, config.timeBucket === "Hourly")
                      : "",
                    rows: points.map((point) => {
                      const series = chartSeries.find((series) =>
                        series.rows.includes(point.datum),
                      );
                      return {
                        label: series?.name ?? "Value",
                        color: point.color,
                        value: formatMetricValue(
                          point.datum.value,
                          series?.metricUnit ?? "number",
                        ),
                      };
                    }),
                  };
                },
              },
            })}
            height={height}
            ariaLabel={insight.name ?? "Events over time"}
          />
        )}
      </ChartSpace>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {chartSeries.map((s, i) => (
          <span
            key={i}
            data-testid="chart-series"
            className="inline-flex items-center gap-2"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function TrendInsightChart(
  props: Parameters<typeof UngroupedTrendInsightChart>[0],
) {
  return (
    <ChartBreakdown insight={props.insight}>
      <UngroupedTrendInsightChart {...props} />
    </ChartBreakdown>
  );
}
