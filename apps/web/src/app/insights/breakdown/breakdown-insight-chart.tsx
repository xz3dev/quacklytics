import {
  formatMetricValue,
  insightMetricUnit,
  metricLabel,
} from "@/lib/metric-value";
import {
  useChartBreakdown,
  breakdownLabel,
  breakdownColor,
} from "@/lib/chart-breakdown";
import { ChartSpace } from "@/components/chart-space";
import { ChartBreakdown } from "@/app/insights/common/chart-breakdown";
import { breakdownRow } from "@quacklytics/contracts";
import { BreakdownInsight } from "@/model/insights/breakdown-insight.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { useMemo } from "react";
import { buildBreakdownQuery } from "@lib/insight-queries.ts";
import { simpleHash } from "@lib/checksums.ts";
import { useDuckDBQuery } from "@/services/duck-db-queries.ts";
import { Spinner } from "@/components/spinner.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";

const barColors = [
  "#2563eb",
  "#7e22ce",
  "#0f766e",
  "#be185d",
  "#dc3545",
  "#a16207",
  "#4d7c0f",
  "#0369a1",
  "#c026d3",
  "#475569",
];
const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

interface Props {
  insight: BreakdownInsight;
  showTable?: boolean;
}

function UngroupedBreakdownInsightChart({ insight, showTable = true }: Props) {
  const breakdown = useChartBreakdown();
  const metricUnit = insightMetricUnit(insight);
  const projectId = useProjectId();
  const query = useMemo(
    () => ({
      query: buildBreakdownQuery(insight.config.breakdown),
      hash: simpleHash(JSON.stringify(insight.config.breakdown)),
    }),
    [insight],
  );
  const result = useDuckDBQuery(
    projectId,
    `breakdown-${query.hash}`,
    query.query,
  );

  if (result.isPending || result.isLoading) return <Spinner />;
  if (result.error)
    return (
      <div className="text-sm text-red-600">Error: {result.error.message}</div>
    );

  const rows = (result.data ?? []).map((raw) => {
    const row = breakdownRow.parse(raw);
    const groupIndex = Number(raw.__breakdown_index);
    return {
      ...row,
      groupIndex,
      dimension_value: breakdown
        ? `${row.dimension_value} · ${breakdownLabel(breakdown.values[groupIndex] ?? null)}`
        : row.dimension_value,
    };
  });
  if (rows.length === 0) {
    return (
      <div className="py-6 text-sm text-muted-foreground">
        No matching events.
      </div>
    );
  }

  const maxValue = Math.max(...rows.map((row) => Number(row.result_value)));

  const tickStep =
    maxValue > 0 ? 10 ** Math.floor(Math.log10(maxValue / 4)) : 1;
  const step = Math.ceil(maxValue / 4 / tickStep) * tickStep || 1;
  const axisMax = step * 4;
  const valueSpace =
    Math.max(
      ...rows.map(
        (row) => Number(row.result_value).toLocaleString("en-US").length,
      ),
    ) + 4;

  return (
    <div className="min-w-0 space-y-5">
      <ChartSpace minimum={rows.length * 40 + 28}>
        {(height) => (
          <TooltipProvider delayDuration={200}>
            <div
              style={{
                height,
                gridTemplateRows: `repeat(${rows.length}, minmax(40px, 1fr)) 28px`,
              }}
              role="img"
              aria-label={insight.name ?? "Breakdown"}
              className="grid min-w-0 grid-cols-[minmax(0,38fr)_minmax(0,62fr)] gap-x-2 text-xs sm:gap-x-3 sm:text-sm"
            >
              {rows.map((row, index) => {
                const value = Number(row.result_value);
                const color = breakdown
                  ? breakdownColor(row.groupIndex)
                  : (barColors[index % barColors.length] ?? "#2563eb");
                return (
                  <div key={row.dimension_value} className="contents">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="min-w-0 truncate rounded-sm text-right text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={row.dimension_value}
                        >
                          {row.dimension_value}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-[min(24rem,calc(100vw-2rem))] break-words"
                      >
                        {row.dimension_value}
                      </TooltipContent>
                    </Tooltip>
                    <div
                      className="relative min-w-0 border-l border-muted-foreground/50 py-1"
                      style={{ paddingRight: `${valueSpace}ch` }}
                    >
                      <div className="relative h-full">
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0"
                        >
                          {[1, 2, 3, 4].map((tick) => (
                            <div
                              key={tick}
                              className="absolute -inset-y-1 border-l border-dashed border-border"
                              style={{ left: `${tick * 25}%` }}
                            />
                          ))}
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`${row.dimension_value}: ${formatMetricValue(value, metricUnit)}`}
                              className="relative block h-full rounded-r-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              style={{
                                width: `${Math.max(0, (value / axisMax) * 100)}%`,
                                minWidth: value > 0 ? 2 : 0,
                                backgroundColor: color,
                              }}
                            >
                              <span
                                className="absolute left-full top-1/2 ml-1 -translate-y-1/2 whitespace-nowrap rounded px-1.5 py-0.5 font-semibold tabular-nums text-white"
                                style={{ backgroundColor: color }}
                              >
                                {value.toLocaleString("en-US")}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-[min(24rem,calc(100vw-2rem))] break-words"
                          >
                            {row.dimension_value}:{" "}
                            {formatMetricValue(value, metricUnit)}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div aria-hidden="true" />
              <div
                aria-hidden="true"
                className="min-w-0"
                style={{ paddingRight: `${valueSpace}ch` }}
              >
                <div className="relative h-7 border-t border-muted-foreground/50 text-[10px] text-muted-foreground sm:text-xs">
                  {[0, 1, 2, 3, 4].map((tick) => (
                    <span
                      key={tick}
                      className="absolute top-2 -translate-x-1/2 tabular-nums"
                      style={{ left: `${tick * 25}%` }}
                    >
                      {compactNumber.format(tick * step)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </TooltipProvider>
        )}
      </ChartSpace>
      {showTable && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Value</TableHead>
              <TableHead className="text-right">
                {metricLabel(metricUnit)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`table-${row.dimension_value}`}>
                <TableCell
                  className="max-w-[240px] break-words"
                  title={row.dimension_value}
                >
                  {row.dimension_value}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Number(row.result_value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function BreakdownInsightChart(
  props: Parameters<typeof UngroupedBreakdownInsightChart>[0],
) {
  return (
    <ChartBreakdown insight={props.insight}>
      <UngroupedBreakdownInsightChart {...props} />
    </ChartBreakdown>
  );
}
