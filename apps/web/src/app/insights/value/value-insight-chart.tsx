import { ChartEmptyState } from "@/components/chart-empty-state";
import { insightMetricUnit } from "@/lib/metric-value";
import { useChartBreakdown, breakdownLabel } from "@/lib/chart-breakdown";
import { AnalyticsChart } from "@/components/analytics-chart";
import { numericResult } from "@quacklytics/contracts";
import { ChartSpace } from "@/components/chart-space";
import { ChartBreakdown } from "@/app/insights/common/chart-breakdown";
import { ValueInsight } from "@/model/insights/value-insight.ts";
import { buildDateRangeFilters, buildRangeFilters } from "@/model/filters.ts";
import { useMemo } from "react";
import { buildQuery, mergeQueries } from "@lib/trend-queries.ts";
import { useDuckDBQuery } from "@/services/duck-db-queries.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { simpleHash } from "@lib/checksums.ts";
import { Spinner } from "@/components/spinner.tsx";
import { determinePreviousDateRange } from "@/model/insights/insight-date-range.ts";

type Props = {
  insight: ValueInsight;
};

function UngroupedValueInsightChart({ insight }: Props) {
  const breakdown = useChartBreakdown();
  const projectId = useProjectId();
  const dateRangeFilter = buildRangeFilters(insight.config.value.duration);
  const prevRange = determinePreviousDateRange(insight.config.value.duration);
  const previousDateRangeFilter = buildDateRangeFilters(
    prevRange.start,
    prevRange.end,
  );

  const query = useMemo(() => {
    const series = insight?.config.value.series;
    const query = mergeQueries(series?.query ?? {}, {
      filters: [...dateRangeFilter],
      aggregations: [
        {
          function: "COUNT",
          field: { name: "id", type: "string" },
          alias: "__matching_events",
        },
      ],
    });
    const hash = simpleHash(
      JSON.stringify(series) + JSON.stringify(insight.config),
    );
    return { projectId, query: buildQuery(query), hash };
  }, [projectId, insight]);

  const queryPrev = useMemo(() => {
    const series = insight?.config.value.series;
    const query = mergeQueries(series?.query ?? {}, {
      filters: [...previousDateRangeFilter],
      aggregations: [
        {
          function: "COUNT",
          field: { name: "id", type: "string" },
          alias: "__matching_events",
        },
      ],
    });
    const hash = simpleHash(
      JSON.stringify(series) + JSON.stringify(insight.config),
    );
    return { projectId, query: buildQuery(query), hash };
  }, [projectId, insight]);

  const queryResult = useDuckDBQuery(
    query.projectId,
    `value-${query.hash}`,
    query.query,
  );
  const queryResultPrev = useDuckDBQuery(
    queryPrev.projectId,
    `value-prev-${queryPrev.hash}`,
    queryPrev.query,
  );

  if (
    queryResult.isPending ||
    queryResult.isLoading ||
    queryResultPrev.isPending ||
    queryResultPrev.isLoading
  )
    return <Spinner />;

  if (queryResult.error || queryResultPrev.error)
    return (
      <div>
        Error: {queryResult.error?.message ?? queryResultPrev.error?.message}
      </div>
    );
  const data = queryResult.data;
  const dataPrev = queryResultPrev.data;

  if (
    [...(data ?? []), ...(dataPrev ?? [])].every(
      (row) => numericResult.parse(row.__matching_events ?? 0) === 0,
    )
  )
    return <ChartEmptyState insight={insight} />;

  if (breakdown) {
    const series = breakdown.values.map((value, index) => {
      const current = data?.find(
        (row) => Number(row.__breakdown_index) === index,
      );
      const previous = dataPrev?.find(
        (row) => Number(row.__breakdown_index) === index,
      );
      return {
        name: `Value · ${breakdownLabel(value)}`,
        points: [
          {
            label: "Current",
            value: numericResult.parse(current?.result_value ?? 0),
          },
          {
            label: "Previous",
            value: numericResult.parse(previous?.result_value ?? 0),
          },
        ],
      };
    });
    return (
      <div className="space-y-4">
        <AnalyticsChart
          metricUnit={insightMetricUnit(insight)}
          points={[]}
          series={series}
          label={insight.name ?? "Value"}
        />
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">Series</th>
              <th>Current</th>
              <th>Previous</th>
            </tr>
          </thead>
          <tbody>
            {series.map((entry, index) => (
              <tr key={index}>
                <td>{entry.name}</td>
                {entry.points.map((point) => (
                  <td key={point.label} className="text-center tabular-nums">
                    {point.value.toLocaleString("en-US")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const result = data?.[0];
  const resultPrev = dataPrev?.[0];

  const value =
    result?.result_value == null
      ? null
      : numericResult.parse(result.result_value);
  const valuePrev =
    resultPrev?.result_value == null
      ? null
      : numericResult.parse(resultPrev.result_value);
  const change =
    value !== null && valuePrev !== null ? value - valuePrev : null;
  const percentage =
    change !== null && valuePrev !== null && valuePrev !== 0
      ? (change / Math.abs(valuePrev)) * 100
      : null;
  const formatChange = (number: number, maximumFractionDigits = 3) =>
    `${number > 0 ? "+" : ""}${number.toLocaleString("en-US", { maximumFractionDigits })}`;
  // Include zero in the shared domain, including for signed aggregations.
  const minimum = Math.min(0, value ?? 0, valuePrev ?? 0);
  const maximum = Math.max(0, value ?? 0, valuePrev ?? 0);
  const span = maximum - minimum || 1;
  const zero = (-minimum / span) * 100;

  return (
    <ChartSpace minimum={240}>
      {(height) => (
        <div className="flex h-full min-w-0 flex-col justify-center gap-6">
          <div
            aria-label="Current value"
            className="font-semibold leading-none tracking-tight tabular-nums break-all"
            style={{ fontSize: Math.min(80, Math.max(36, height / 5)) }}
          >
            {value?.toLocaleString("en-US") ?? "—"}
          </div>
          <div
            className="space-y-5"
            role="group"
            aria-label="Period comparison"
          >
            {[
              {
                label: "Current period",
                amount: value,
                color: "bg-blue-500 dark:bg-blue-400",
              },
              {
                label: "Previous period",
                amount: valuePrev,
                color: "bg-slate-400 dark:bg-slate-500",
              },
            ].map(({ label, amount, color }) => (
              <div key={label}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium tabular-nums break-all">
                    {amount?.toLocaleString("en-US") ?? "—"}
                  </span>
                </div>
                <div
                  className="relative h-3 w-full rounded-full bg-muted"
                  aria-hidden="true"
                >
                  {minimum < 0 && (
                    <span
                      className="absolute -top-1 h-5 w-px bg-border"
                      style={{ left: `${zero}%` }}
                    />
                  )}
                  <div
                    data-comparison-bar={label}
                    className={`absolute h-full rounded-full ${color}`}
                    style={{
                      left: `${amount !== null && amount < 0 ? ((amount - minimum) / span) * 100 : zero}%`,
                      width: `${amount === null ? 0 : (Math.abs(amount) / span) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div aria-label="Period change" className="text-sm">
            {change === null ? (
              <span className="text-muted-foreground">
                Comparison unavailable
              </span>
            ) : (
              <>
                <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                  {formatChange(change)}
                  {percentage !== null && ` (${formatChange(percentage, 1)}%)`}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {change === 0
                    ? "No change"
                    : valuePrev === 0
                      ? "vs. previous period · percentage unavailable from zero"
                      : "vs. previous period"}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </ChartSpace>
  );
}

export function ValueInsightChart(
  props: Parameters<typeof UngroupedValueInsightChart>[0],
) {
  return (
    <ChartBreakdown insight={props.insight}>
      <UngroupedValueInsightChart {...props} />
    </ChartBreakdown>
  );
}
