import { tooltip, type ChartTooltipInput } from "@tanstack/charts/tooltip";
import type {
  ChartTheme,
  ChartAxisOptions,
  ChartValue,
} from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts/scales/linear";

export const chartTheme = {
  foreground: "hsl(var(--foreground))",
  muted: "hsl(var(--muted-foreground))",
  grid: "hsl(var(--border) / 0.65)",
  background: "hsl(var(--card))",
} satisfies Partial<ChartTheme>;

export const chartAxis = {
  line: false,
  ticks: { size: 0, padding: 10, spacing: 80 },
  tickLabels: { fontSize: 11 },
} satisfies ChartAxisOptions<ChartValue>["axis"];

const compactNumber = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const chartValueScale = {
  scale: scaleLinear,
  nice: true,
  grid: {
    strokeDasharray: "1 5",
    strokeWidth: 1,
    strokeOpacity: 1,
    lineCap: "round",
  } satisfies ChartAxisOptions<ChartValue>["grid"],
  axis: {
    ...chartAxis,
    ticks: {
      size: 0,
      padding: 10,
      count: 4,
      format: (value: ChartValue) =>
        typeof value === "number" ? compactNumber.format(value) : String(value),
    },
  },
};

export function formatChartDate(value: ChartValue, hourly: boolean) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(hourly ? { hour: "numeric" } : {}),
  }).format(date);
}

export const chartTooltip = {
  use: tooltip,
  className: "analytics-tooltip",
  anchor: "pointer",
  offset: 16,
} satisfies ChartTooltipInput;

export function formatTooltipDate(value: ChartValue, hourly: boolean) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(hourly
      ? { hour: "numeric", minute: "2-digit", timeZoneName: "short" }
      : {}),
  }).format(date);
}
