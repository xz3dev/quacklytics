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
import { format } from "date-fns";

interface Props {
  insight: RetentionInsight;
}

interface CohortRow {
  cohortStart: string;
  cohortSize: number;
  periods: Map<number, number>;
}

export function RetentionInsightChart({ insight }: Props) {
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

  const rows = retentionRow.array().parse(result.data ?? []);
  const cohorts = buildCohorts(rows);
  if (cohorts.length === 0) {
    return (
      <div className="py-6 text-sm text-muted-foreground">
        No actors with retention data.
      </div>
    );
  }

  const maxPeriods = Math.max(0, insight.config.retention.maxPeriods ?? 14);
  const periods = Array.from({ length: maxPeriods + 1 }, (_, index) => index);

  const cells = cohorts.flatMap((cohort) =>
    periods.map((period) => {
      const retained = cohort.periods.get(period) ?? 0;
      const percentage = cohort.cohortSize
        ? (retained / cohort.cohortSize) * 100
        : 0;
      return {
        cohort: cohort.cohortStart.slice(0, 10),
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
            value: point.datum.retained.toLocaleString("en-US"),
          },
        ]),
      }),
    },
  });
  return (
    <div className="overflow-x-auto">
      <Chart
        definition={definition}
        height={Math.min(450, Math.max(180, cohorts.length * 32 + 48))}
        ariaLabel={insight.name ?? "Retention"}
      />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card px-2 py-2 text-left font-medium">
              Cohort
            </th>
            <th className="px-2 py-2 text-right font-medium">Users</th>
            {periods.map((period) => (
              <th
                key={period}
                className="min-w-20 px-2 py-2 text-right font-medium"
              >
                P{period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((cohort) => (
            <tr key={cohort.cohortStart} className="even:bg-muted/40">
              <td className="sticky left-0 bg-card px-2 py-2 font-medium">
                {format(new Date(cohort.cohortStart), "yyyy-MM-dd")}
              </td>
              <td className="px-2 py-2 text-right tabular-nums">
                {cohort.cohortSize}
              </td>
              {periods.map((period) => {
                const count = cohort.periods.get(period) ?? 0;
                const percentage =
                  cohort.cohortSize > 0 ? (count / cohort.cohortSize) * 100 : 0;
                return (
                  <td key={period} className="px-1 py-1">
                    <div
                      className="rounded-sm px-2 py-2 text-right tabular-nums"
                      style={{
                        backgroundColor: `hsl(var(--chart-1) / ${Math.max(0.08, percentage / 100)})`,
                      }}
                      title={`${count} retained users`}
                    >
                      {percentage.toFixed(0)}%
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
