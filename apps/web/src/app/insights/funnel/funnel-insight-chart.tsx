import { useId, useMemo } from "react";
import { Chart } from "@tanstack/charts/react";
import { barY, defineChart, group } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { portal } from "@tanstack/charts/tooltip/portal";
import { ChartSpace } from "@/components/chart-space";
import {
  chartAxis,
  chartTheme,
  chartTooltip,
  chartValueScale,
} from "@/components/chart-style";
import { breakdownColor } from "@/lib/chart-breakdown";
import { formatMetricValue, type MetricUnit } from "@/lib/metric-value";
import {
  funnelDuration,
  funnelPercent,
  type FunnelPoint,
} from "@/lib/funnel-metrics";

export function FunnelInsightChart({
  series,
  label,
  metricUnit,
  countLabel,
  grouped,
}: {
  series: { name: string; points: FunnelPoint[] }[];
  label: string;
  metricUnit: MetricUnit;
  countLabel: string;
  grouped: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const colors = series.map((_, index) =>
    grouped ? breakdownColor(index) : "hsl(var(--chart-1))",
  );
  const definition = useMemo(() => {
    const entries = series.map((entry, groupIndex) => ({
      ...entry,
      points: entry.points.map((point) => ({
        ...point,
        groupIndex,
        groupName: entry.name,
      })),
    }));
    const maxPercent = Math.max(
      100,
      ...series.flatMap((entry) =>
        entry.points.map((point) => point.conversion ?? 0),
      ),
    );
    return defineChart({
      theme: chartTheme,
      margin: { top: 12, right: 18 },
      marks: [
        ...entries.map((entry, index) =>
          barY(entry.points, {
            x: "index",
            y: (point) => point.conversion ?? 0,
            z: () => index,
            layout: group({
              scale: scaleBand<number>()
                .domain(entries.map((_, i) => i))
                .paddingInner(0.05)
                .paddingOuter(0),
            }),
            fill: grouped ? breakdownColor(index) : "hsl(var(--chart-1))",
            radius: { end: 5 },
          }),
        ),
        ...entries.map((entry, index) =>
          barY(
            entry.points.filter(
              (point) => point.start > 0 && (point.conversion ?? 0) < 100,
            ),
            {
              x: "index",
              y1: (point) => point.conversion ?? 0,
              y2: 100,
              z: () => index,
              layout: group({
                scale: scaleBand<number>()
                  .domain(entries.map((_, i) => i))
                  .paddingInner(0.05)
                  .paddingOuter(0),
              }),
              fill: `url(#${id}-drop-${index})`,
              radius: { end: 5 },
            },
          ),
        ),
      ],
      scales: {
        x: {
          scale: () => scaleBand().paddingInner(0.06).paddingOuter(0),
          axis: {
            ...chartAxis,
            ticks: {
              ...chartAxis.ticks,
              format: (value) => {
                const point = series[0]?.points.find(
                  (point) => point.index === value,
                );
                const text = point
                  ? `${point.index + 1}. ${point.label}`
                  : String(value);
                return text.length > 22 ? `${text.slice(0, 21)}…` : text;
              },
            },
          },
        },
        y: {
          ...chartValueScale,
          scale: () => scaleLinear().domain([0, maxPercent]),
          nice: false,
          axis: {
            ...chartAxis,
            ticks: {
              size: 0,
              padding: 10,
              count: 5,
              format: (value) => `${value}%`,
            },
          },
        },
      },
      focus: "nearest",
      tooltip: {
        ...chartTooltip,
        portal,
        placement: "right",
        className: "analytics-tooltip funnel-tooltip",
        content: (points) => {
          const point = points[0]?.datum;
          if (!point) return { title: "", rows: [] };
          const color = grouped
            ? breakdownColor(point.groupIndex)
            : "hsl(var(--chart-1))";
          return {
            title: `Step ${point.index + 1}: ${point.label}${grouped ? ` · ${point.groupName}` : ""}`,
            rows: [
              {
                label: `Completed · ${countLabel}`,
                value: formatMetricValue(point.value, metricUnit),
                color,
              },
              {
                label: "Conversion from previous",
                value: funnelPercent(point.conversionPrevious),
              },
              {
                label: "Conversion from start",
                value: funnelPercent(point.conversion),
              },
              {
                label: "Dropped off from previous",
                value: `${formatMetricValue(point.dropped, metricUnit)} · ${funnelPercent(point.dropRate)}`,
              },
              {
                label: "Dropped off from start",
                value: `${formatMetricValue(point.droppedFromStart, metricUnit)} · ${funnelPercent(point.dropRateFromStart)}`,
              },
              {
                label: "Avg. time from previous",
                value: funnelDuration(point.averageSeconds),
              },
            ],
          };
        },
      },
    });
  }, [series, grouped, id, countLabel, metricUnit]);

  return (
    <div className="min-w-0 space-y-3">
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          {colors.map((color, index) => (
            <pattern
              key={index}
              id={`${id}-drop-${index}`}
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="10" height="10" fill={color} fillOpacity="0.12" />
              <rect width="5" height="10" fill={color} fillOpacity="0.2" />
            </pattern>
          ))}
        </defs>
      </svg>
      <ChartSpace minimum={220}>
        {(height) => (
          <Chart
            definition={definition}
            height={height}
            ariaLabel={label}
            ariaDescription="Solid bars show completion from the first step. Hatched segments show cumulative drop-off. Arrow keys explore step details."
          />
        )}
      </ChartSpace>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span
            className="size-2.5 rounded-sm"
            style={{
              backgroundColor: grouped
                ? "hsl(var(--foreground))"
                : "hsl(var(--chart-1))",
            }}
          />
          Completed
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className="size-2.5 rounded-sm bg-primary/20"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, transparent 0 2px, hsl(var(--primary) / 0.35) 2px 4px)",
            }}
          />
          Dropped off from start
        </span>
        {grouped &&
          series.map((entry, index) => (
            <span
              key={index}
              data-testid="chart-series"
              className="inline-flex min-w-0 items-center gap-2"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: colors[index] }}
              />
              <span className="truncate" title={entry.name}>
                {entry.name}
              </span>
            </span>
          ))}
      </div>
    </div>
  );
}
