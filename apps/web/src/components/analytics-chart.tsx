import { Chart } from "@tanstack/charts/react";
import { defineChart, barY } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import {
  chartAxis,
  chartTheme,
  chartValueScale,
  chartTooltip,
} from "./chart-style";
import type { ChartPoint } from "@quacklytics/contracts";
import { useMemo } from "react";
export function AnalyticsChart({
  points,
  label,
  showCategoryAxis = true,
}: {
  points: ChartPoint[];
  label: string;
  showCategoryAxis?: boolean;
}) {
  const definition = useMemo(
    () =>
      defineChart({
        theme: chartTheme,
        margin: { top: 12, right: 18 },
        marks: [
          barY(points, {
            x: "label",
            y: "value",
            fill: "hsl(var(--chart-1))",
            radius: 4,
            maxThickness: 32,
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand().padding(0.35),
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
        tooltip: {
          ...chartTooltip,
          content: (points) => ({
            title: points[0]?.datum.label ?? "",
            rows: points.map((point) => ({
              label: "Value",
              value: point.datum.value.toLocaleString("en-US", {
                maximumFractionDigits: 6,
              }),
              color: "hsl(var(--chart-1))",
            })),
          }),
        },
      }),
    [points, showCategoryAxis],
  );
  return <Chart definition={definition} height={220} ariaLabel={label} />;
}
