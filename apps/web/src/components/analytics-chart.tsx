import { formatMetricValue, type MetricUnit } from "@/lib/metric-value";
import { breakdownColor } from "@/lib/chart-breakdown";
import { ChartSpace } from "@/components/chart-space";
import { Chart } from "@tanstack/charts/react";
import { defineChart, barY, group } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import {
  chartAxis,
  chartTheme,
  chartValueScale,
  chartTooltip,
  nearbyChartFocus,
} from "./chart-style";
import type { ChartPoint } from "@quacklytics/contracts";
import { useMemo } from "react";
export function AnalyticsChart({
  points,
  label,
  showCategoryAxis = true,
  series,
  fillBarWidth = false,
  valueLabel = "Value",
  metricUnit,
}: {
  points: ChartPoint[];
  label: string;
  showCategoryAxis?: boolean;
  series?: { name: string; points: ChartPoint[] }[];
  fillBarWidth?: boolean;
  valueLabel?: string;
  metricUnit: MetricUnit;
}) {
  const definition = useMemo(
    () =>
      defineChart({
        theme: chartTheme,
        margin: { top: 12, right: 18 },
        marks: (series ?? [{ name: valueLabel, points }]).map((entry, index) =>
          barY(entry.points, {
            x: "label",
            y: "value",
            z: () => index,
            ...(series
              ? {
                  layout: group({
                    scale: scaleBand<number>()
                      .domain(series.map((_, i) => i))
                      .paddingInner(fillBarWidth ? 0.05 : 0.15)
                      .paddingOuter(fillBarWidth ? 0 : 0.15),
                  }),
                }
              : {}),
            fill: series ? breakdownColor(index) : "hsl(var(--chart-1))",
            radius: 4,
            ...(fillBarWidth ? {} : { maxThickness: 32 }),
          }),
        ),
        scales: {
          x: {
            scale: () =>
              fillBarWidth
                ? scaleBand().paddingInner(0.05).paddingOuter(0)
                : scaleBand().padding(0.35),
            axis: showCategoryAxis
              ? {
                  ...chartAxis,
                  ticks: {
                    ...chartAxis.ticks,
                    format: (value) => {
                      const label = String(value);
                      return label.length > 14
                        ? `${label.slice(0, 13)}…`
                        : label;
                    },
                  },
                }
              : false,
          },
          y: chartValueScale,
        },
        focus: nearbyChartFocus,
        // Wide funnel bars must remain hoverable beyond the usual point radius.
        ...(fillBarWidth ? { maxFocusDistance: Infinity } : {}),
        tooltip: {
          ...chartTooltip,
          content: (points) => ({
            title: points[0]?.datum.label ?? "",
            rows: points.map((point) => {
              const entry = series?.find((entry) =>
                entry.points.includes(point.datum),
              );
              return {
                label: entry?.name ?? valueLabel,
                value: formatMetricValue(point.datum.value, metricUnit),
                color: point.color,
              };
            }),
          }),
        },
      }),
    [points, showCategoryAxis, series, fillBarWidth, valueLabel, metricUnit],
  );
  return (
    <div className="min-w-0 space-y-4">
      <ChartSpace minimum={220}>
        {(height) => (
          <Chart definition={definition} height={height} ariaLabel={label} />
        )}
      </ChartSpace>
      {series && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {series.map((entry, index) => (
            <span
              key={index}
              data-testid="chart-series"
              className="inline-flex items-center gap-2"
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: breakdownColor(index) }}
              />
              {entry.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
