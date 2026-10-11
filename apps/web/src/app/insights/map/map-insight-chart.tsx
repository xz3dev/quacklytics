import { ChartEmptyState } from "@/components/chart-empty-state";
import {
  formatMetricValue,
  insightMetricUnit,
  metricLabel,
  type MetricUnit,
} from "@/lib/metric-value";
import { ChartSpace } from "@/components/chart-space";
import { Chart } from "@tanstack/charts/react";
import { defineChart, type ChartPoint } from "@tanstack/charts";
import { geoShape } from "@tanstack/charts/geo";
import { geoContains, geoEqualEarth, type GeoProjection } from "d3-geo";
import { chartTheme, chartTooltip } from "@/components/chart-style";
import { breakdownRow } from "@quacklytics/contracts";
import { MapInsight } from "@/model/insights/map-insight.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { useMemo, useState } from "react";
import { buildMapQuery } from "@lib/insight-queries.ts";
import { simpleHash } from "@lib/checksums.ts";
import { useDuckDBQuery } from "@/services/duck-db-queries.ts";
import { useServerSetup } from "@/services/server-setup.ts";
import { Spinner } from "@/components/spinner.tsx";
import {
  countryLabel,
  useCountryShapes,
  type CountryShape,
} from "@lib/world-countries.ts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";

const MISSING = "(missing)";
const noData = "hsl(var(--muted))";

interface Props {
  insight: MapInsight;
  showTable?: boolean;
}

interface CountryValue {
  code: string;
  label: string;
  value: number;
}

export function MapInsightChart({ insight, showTable = true }: Props) {
  const projectId = useProjectId();
  const metricUnit = insightMetricUnit(insight);
  const query = useMemo(
    () => ({
      query: buildMapQuery(insight.config.map),
      hash: simpleHash(JSON.stringify(insight.config.map)),
    }),
    [insight],
  );
  const result = useDuckDBQuery(projectId, `map-${query.hash}`, query.query);
  const shapes = useCountryShapes();
  const geoip = useServerSetup().data?.geoip;

  if (result.isPending || result.isLoading || shapes.isPending)
    return <Spinner />;
  if (result.error || shapes.error)
    return (
      <div className="text-sm text-red-600">
        Error: {(result.error ?? shapes.error)?.message}
      </div>
    );

  const rows: CountryValue[] = (result.data ?? []).map((raw) => {
    const row = breakdownRow.parse(raw);
    return {
      code: row.dimension_value,
      label:
        row.dimension_value === MISSING
          ? "Unknown"
          : countryLabel(row.dimension_value),
      value: row.result_value,
    };
  });
  if (rows.length === 0) return <ChartEmptyState insight={insight} />;

  const onMap = new Set(shapes.data.map((shape) => shape.properties.code));
  const offMap = rows.filter((row) => !onMap.has(row.code));
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="min-w-0 space-y-3">
      <WorldMap
        shapes={shapes.data}
        rows={rows}
        total={total}
        metricUnit={metricUnit}
        label={insight.name ?? "Map"}
      />
      {offMap.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Not on the map:{" "}
          {offMap
            .map((row) => `${row.label} (${row.value.toLocaleString("en-US")})`)
            .join(", ")}
        </p>
      )}
      {geoip === "db-ip" && (
        <p className="text-[11px] text-muted-foreground">
          <a
            href="https://db-ip.com"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
          >
            IP Geolocation by DB-IP
          </a>
        </p>
      )}
      {showTable && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Country</TableHead>
              <TableHead className="text-right">
                {metricLabel(metricUnit)}
              </TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.code}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.value.toLocaleString("en-US")}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatShare(row.value, total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function WorldMap({
  shapes,
  rows,
  total,
  metricUnit,
  label,
}: {
  shapes: CountryShape[];
  rows: CountryValue[];
  total: number;
  metricUnit: MetricUnit;
  label: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const values = useMemo(
    () => new Map(rows.map((row) => [row.code, row.value])),
    [rows],
  );
  const steps = useMemo(
    () => colorSteps(Math.max(0, ...rows.map((row) => row.value))),
    [rows],
  );
  const definition = useMemo(() => {
    const valueOf = (shape: CountryShape) =>
      (shape.properties.code && values.get(shape.properties.code)) || 0;
    // Shared with focus resolution, which hit-tests the pointer against outlines.
    let projection: GeoProjection | undefined;
    const fitted = ({
      chart,
    }: {
      chart: { x: number; y: number; width: number; height: number };
    }) => {
      projection = geoEqualEarth().fitExtent(
        [
          [chart.x, chart.y],
          [chart.x + chart.width, chart.y + chart.height],
        ],
        { type: "FeatureCollection", features: shapes },
      );
      return projection;
    };
    const highlighted = shapes.filter(
      (shape) => hovered !== null && shape.properties.code === hovered,
    );
    return defineChart({
      theme: chartTheme,
      margin: 4,
      scales: { x: null, y: null },
      marks: [
        geoShape(shapes, {
          projection: fitted,
          key: (shape) => shape.properties.code ?? shape.properties.name,
          fill: (shape) => colorFor(valueOf(shape), steps),
          stroke: "hsl(var(--card))",
          strokeWidth: 0.6,
        }),
        geoShape(highlighted, {
          id: "map-highlight",
          projection: fitted,
          fill: "none",
          stroke: "hsl(var(--foreground))",
          strokeWidth: 1.5,
        }),
      ],
      focusRing: false,
      focus: {
        resolve: (points, { x, y }) => {
          const coordinates = projection?.invert?.([x, y]);
          if (!coordinates) return [];
          const hit = points.find(
            (point) =>
              point.markId !== "map-highlight" &&
              geoContains(point.datum, coordinates),
          );
          return hit ? [hit] : [];
        },
        group: (_points, { point }) => [point],
        // Keyboard focus steps through countries with data, largest first.
        navigation: (points) =>
          points
            .filter(
              (point) =>
                point.markId !== "map-highlight" && valueOf(point.datum) > 0,
            )
            .sort((a, b) => valueOf(b.datum) - valueOf(a.datum)),
      },
      keyboard: true,
      tooltip: {
        ...chartTooltip,
        content: (
          points: readonly ChartPoint<CountryShape, number, number>[],
        ) => {
          const shape = points[0]?.datum;
          if (!shape) return { title: "", rows: [] };
          const value = valueOf(shape);
          return {
            title: shape.properties.code
              ? countryLabel(shape.properties.code)
              : shape.properties.name,
            rows: value
              ? [
                  {
                    label: metricLabel(metricUnit),
                    value: formatMetricValue(value, metricUnit),
                    color: colorFor(value, steps),
                  },
                  { label: "Share", value: formatShare(value, total) },
                ]
              : [{ label: metricLabel(metricUnit), value: "No data" }],
          };
        },
      },
    });
  }, [shapes, values, steps, hovered, metricUnit, total]);

  return (
    <div className="min-w-0 space-y-2">
      <ChartSpace minimum={240}>
        {(height) => (
          <Chart
            definition={definition}
            height={height}
            ariaLabel={label}
            onFocusChange={(point) =>
              setHovered(point?.datum.properties.code ?? null)
            }
          />
        )}
      </ChartSpace>
      <Legend steps={steps} metricUnit={metricUnit} />
    </div>
  );
}

interface ColorStep {
  upper: number;
  color: string;
}

/**
 * Up to five log-spaced buckets: one dominant country would otherwise leave
 * every other country in the palest shade.
 */
function colorSteps(max: number): ColorStep[] {
  if (max <= 0) return [];
  const count = Math.min(5, Math.ceil(max));
  const uppers = [
    ...new Set(
      Array.from({ length: count }, (_, index) =>
        // The last bucket ends exactly at the maximum, despite float rounding.
        index === count - 1
          ? max
          : Math.min(
              max,
              Math.ceil(Math.expm1((Math.log1p(max) * (index + 1)) / count)),
            ),
      ),
    ),
  ];
  return uppers.map((upper, index) => ({
    upper,
    color: `hsl(var(--chart-1) / ${
      uppers.length === 1 ? 1 : 0.22 + (0.78 * index) / (uppers.length - 1)
    })`,
  }));
}

function colorFor(value: number, steps: ColorStep[]) {
  if (value <= 0) return noData;
  return (
    steps.find((step) => value <= step.upper)?.color ??
    steps.at(-1)?.color ??
    noData
  );
}

function Legend({
  steps,
  metricUnit,
}: {
  steps: ColorStep[];
  metricUnit: MetricUnit;
}) {
  const max = steps.at(-1)?.upper;
  if (max === undefined) return null;
  return (
    <div
      data-testid="map-legend"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground"
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className="size-2.5 rounded-sm"
          style={{ backgroundColor: noData }}
        />
        No data
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="tabular-nums">1</span>
        <span className="flex gap-0.5">
          {steps.map((step, index) => (
            <span
              key={step.upper}
              title={`${index ? (steps[index - 1]?.upper ?? 0) + 1 : 1}–${step.upper}`}
              className="h-2.5 w-5 rounded-sm"
              style={{ backgroundColor: step.color }}
            />
          ))}
        </span>
        <span className="tabular-nums">
          {formatMetricValue(max, metricUnit)}
        </span>
      </span>
    </div>
  );
}

function formatShare(value: number, total: number) {
  if (!total) return "–";
  return `${((value / total) * 100).toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })}%`;
}
