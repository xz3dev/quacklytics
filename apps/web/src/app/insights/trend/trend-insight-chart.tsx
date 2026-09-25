import { trendRow } from "@quacklytics/contracts";
import { useDuckDBQueries } from "@/services/duck-db-queries";
import type { TrendInsight } from "@/model/insights/trend-insight";
import { useProjectId } from "@/hooks/use-project-id";
import { buildQuery, mergeQueries } from "@/lib/trend-queries";
import { buildGroupByFilter, buildRangeFilters } from "@/model/filters";
import { Chart } from "@tanstack/charts/react";
import { defineChart, lineY, barY } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import {
  chartTooltip,
  formatTooltipDate,
  chartAxis,
  chartTheme,
  chartValueScale,
  formatChartDate,
} from "@/components/chart-style";
export function TrendInsightChart({ insight }: { insight: TrendInsight }) {
  const project = useProjectId();
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
  const chartSeries = series.map((s, i) => ({
    ...s,
    name: s.name?.trim() || `Series ${i + 1}`,
    color: `hsl(var(--chart-${(i % 5) + 1}))`,
    rows: trendRow
      .array()
      .parse(results[i]?.data ?? [])
      .map((r) => ({ date: r.trend_bucket, value: r.result_value })),
  }));
  const marks = chartSeries.map((s) => {
    const { rows, color } = s;
    return s.visualisation === "bar"
      ? barY(rows, {
          x: "date",
          y: "value",
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
          focus: "group-x",
          maxFocusDistance: Number.POSITIVE_INFINITY,
          tooltip: {
            ...chartTooltip,
            content: (points) => {
              const date = points[0]?.datum.date;
              return {
                title: date
                  ? formatTooltipDate(date, config.timeBucket === "Hourly")
                  : "",
                rows: chartSeries.map((s) => {
                  const row = s.rows.find((row) => row.date === date);
                  return {
                    label: s.name,
                    color: s.color,
                    value: row
                      ? row.value.toLocaleString("en-US", {
                          maximumFractionDigits: 6,
                        })
                      : "No data",
                  };
                }),
              };
            },
          },
        })}
        height={240}
        ariaLabel={insight.name ?? "Events over time"}
      />
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {chartSeries.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-2">
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
