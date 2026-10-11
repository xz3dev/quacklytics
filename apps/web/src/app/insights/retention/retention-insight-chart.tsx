import { ChartEmptyState } from "@/components/chart-empty-state";
import { formatMetricValue, insightMetricUnit } from "@/lib/metric-value";
import { format } from "date-fns";
import { useChartBreakdown, breakdownLabel } from "@/lib/chart-breakdown";
import { ChartSpace } from "@/components/chart-space";
import { ChartBreakdown } from "@/app/insights/common/chart-breakdown";
import { Chart } from "@tanstack/charts/react";
import { defineChart, cell } from "@tanstack/charts";
import { scaleBand } from "@tanstack/charts/scales/band";
import { chartTooltip } from "@/components/chart-style";
import { retentionRow, type RetentionRow } from "@quacklytics/contracts";
import { RetentionInsight } from "@/model/insights/retention-insight.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { useMemo } from "react";
import { buildRetentionQuery } from "@lib/insight-queries.ts";
import { simpleHash } from "@lib/checksums.ts";
import { useDuckDBQuery } from "@/services/duck-db-queries.ts";
import { Spinner } from "@/components/spinner.tsx";

interface Props {
  insight: RetentionInsight;
}

interface CohortRow {
  cohortStart: string;
  label: string;
  cohortSize: number;
  periods: Map<number, number>;
}

function UngroupedRetentionInsightChart({ insight }: Props) {
  const breakdown = useChartBreakdown();
  const projectId = useProjectId();
  const query = useMemo(
    () => ({
      query: buildRetentionQuery(insight.config.retention),
      hash: simpleHash(JSON.stringify(insight.config.retention)),
    }),
    [insight],
  );
  const result = useDuckDBQuery(
    projectId,
    `retention-${query.hash}`,
    query.query,
  );

  if (result.isPending || result.isLoading) return <Spinner />;
  if (result.error)
    return (
      <div className="text-sm text-red-600">Error: {result.error.message}</div>
    );

  const cohorts = (breakdown?.values ?? [null]).flatMap((value, index) =>
    buildCohorts(
      retentionRow
        .array()
        .parse(
          (result.data ?? []).filter(
            (row) => !breakdown || Number(row.__breakdown_index) === index,
          ),
        ),
    ).map((cohort) => ({
      ...cohort,
      label: `${format(new Date(cohort.cohortStart), "yyyy-MM-dd")}${breakdown ? ` · ${breakdownLabel(value)}` : ""}`,
    })),
  );
  if (cohorts.length === 0) return <ChartEmptyState insight={insight} />;

  const maxPeriods = Math.max(0, insight.config.retention.maxPeriods ?? 14);
  const periods = Array.from({ length: maxPeriods + 1 }, (_, index) => index);

  const cells = cohorts.flatMap((cohort) =>
    periods.map((period) => {
      const retained = cohort.periods.get(period) ?? 0;
      const percentage = cohort.cohortSize
        ? (retained / cohort.cohortSize) * 100
        : 0;
      return {
        cohort: cohort.label,
        period: `P${period}`,
        retained,
        percentage,
        level: String(Math.round(percentage / 10)),
      };
    }),
  );
  const levels = Array.from({ length: 11 }, (_, i) => String(i));
  const definition = defineChart({
    marks: [
      cell(cells, { x: "period", y: "cohort", color: "level", inset: 1 }),
    ],
    scales: { x: { scale: scaleBand }, y: { scale: scaleBand } },
    color: {
      domain: levels,
      range: levels.map(
        (level) =>
          `hsl(var(--chart-1) / ${Math.max(0.08, Number(level) / 10)})`,
      ),
    },
    tooltip: {
      ...chartTooltip,
      content: (points) => ({
        title: points[0]
          ? `Cohort ${points[0].datum.cohort} · ${points[0].datum.period}`
          : "",
        rows: points.flatMap((point) => [
          {
            label: "Retention",
            value: `${point.datum.percentage.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`,
            color: "hsl(var(--chart-1))",
          },
          {
            label: "Users",
            value: formatMetricValue(
              point.datum.retained,
              insightMetricUnit(insight),
            ),
          },
        ]),
      }),
    },
  });
  return (
    <div className="overflow-x-auto">
      <ChartSpace minimum={Math.max(180, cohorts.length * 32 + 48)}>
        {(height) => (
          <Chart
            definition={definition}
            height={height}
            ariaLabel={insight.name ?? "Retention"}
          />
        )}
      </ChartSpace>
    </div>
  );
}

function buildCohorts(rows: RetentionRow[]): CohortRow[] {
  const cohorts = new Map<string, CohortRow>();
  for (const row of rows) {
    const cohortStart = new Date(row.cohort_start).toISOString();
    const period = Number(row.period_index);
    const count = Number(row.retained_count);
    const cohort = cohorts.get(cohortStart) ?? {
      cohortStart,
      label: cohortStart,
      cohortSize: 0,
      periods: new Map<number, number>(),
    };
    cohort.periods.set(period, count);
    if (period === 0) cohort.cohortSize = count;
    cohorts.set(cohortStart, cohort);
  }
  return Array.from(cohorts.values()).sort((a, b) =>
    a.cohortStart.localeCompare(b.cohortStart),
  );
}

export function RetentionInsightChart(
  props: Parameters<typeof UngroupedRetentionInsightChart>[0],
) {
  return (
    <ChartBreakdown insight={props.insight}>
      <UngroupedRetentionInsightChart {...props} />
    </ChartBreakdown>
  );
}
