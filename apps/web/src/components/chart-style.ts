import { tooltip, type ChartTooltipInput } from "@tanstack/charts/tooltip";
import type {
  ChartTheme,
  ChartAxisOptions,
  ChartValue,
  ChartPoint,
  ChartFocusResolveContext,
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

// Compare rendered positions so proximity stays consistent across value
// ranges and responsive chart sizes. The hovered point is always first.
function nearbyTooltipPoints<T extends { x: number; y: number }>(
  points: readonly T[],
): T[] {
  const hovered = points[0];
  if (!hovered) return [];
  return points.filter(
    (point) => Math.hypot(point.x - hovered.x, point.y - hovered.y) <= 12,
  );
}

// Use rendered x positions to distinguish side-by-side bars, including when
// their values are equal. Semantic category grouping alone loses that distinction.
export const nearbyChartFocus = {
  resolve<T extends ChartPoint>(
    points: readonly T[],
    { x, y, maxDistance }: ChartFocusResolveContext,
  ): T[] {
    let hovered: (typeof points)[number] | undefined;
    let distanceX = maxDistance;
    let distanceY = Number.POSITIVE_INFINITY;
    for (const point of points) {
      const dx = Math.abs(point.x - x);
      const dy = Math.abs(point.y - y);
      if (dx < distanceX || (dx === distanceX && dy < distanceY)) {
        hovered = point;
        distanceX = dx;
        distanceY = dy;
      }
    }
    return hovered ? this.group(points, { point: hovered }) : [];
  },
  group<T extends ChartPoint>(
    points: readonly T[],
    { point }: { point: T },
  ): T[] {
    return nearbyTooltipPoints([
      point,
      ...points.filter((candidate) => {
        const x = candidate.xValue;
        const hoveredX = point.xValue;
        return (
          candidate !== point &&
          (x instanceof Date && hoveredX instanceof Date
            ? x.getTime() === hoveredX.getTime()
            : x === hoveredX)
        );
      }),
    ]);
  },
  navigation<T extends ChartPoint>(points: readonly T[]): T[] {
    return [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  },
};
