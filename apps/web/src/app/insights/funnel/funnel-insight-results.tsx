import { ChartEmptyState } from "@/components/chart-empty-state";
import { insightMetricUnit } from "@/lib/metric-value";
import { useState } from "react";
import { ArrowRight, ArrowDownRight, Clock3 } from "lucide-react";
import { useChartBreakdown, breakdownLabel } from "@/lib/chart-breakdown";
import { ChartBreakdown } from "@/app/insights/common/chart-breakdown";
import { FunnelInsightChart } from "./funnel-insight-chart";
import {
  funnelDuration,
  funnelPercent,
  type FunnelPoint,
} from "@/lib/funnel-metrics";
import { numericResult } from "@quacklytics/contracts";
import type { FunnelInsight } from "@/model/insights/funnel-insights";
import { determineDateRange } from "@/model/insights/insight-date-range";
import { buildFunnelQuery } from "@/lib/funnel-queries";
import { useDuckDBQuery } from "@/services/duck-db-queries";
import { useProjectId } from "@/hooks/use-project-id";
import { simpleHash } from "@/lib/checksums";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Spinner } from "@/components/spinner";
interface Props {
  insight: FunnelInsight;
  layoutDirection: "horizontal" | "vertical";
  detailedResults?: boolean;
}
function BreakdownLabel({ name }: { name: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => setExpanded((value) => !value)}
      title={name}
      className={`block w-full max-w-[calc(100vw-10rem)] rounded-sm text-left font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${expanded ? "whitespace-normal wrap-break-word" : "truncate"}`}
    >
      {name}
    </button>
  );
}

function UngroupedFunnelInsightResults(props: Props) {
  if (!props.insight.config.funnel.steps?.length)
    return <ChartEmptyState insight={props.insight} />;
  return <ConfiguredFunnel {...props} />;
}
function ConfiguredFunnel({ insight }: Props) {
  const breakdown = useChartBreakdown();
  const conf = insight.config.funnel;
  const countLabel =
    conf.countingMode === "eventCount"
      ? "Events"
      : conf.countingMode === "uniqueSessions"
        ? "Unique sessions"
        : "Unique users";
  const steps = conf.steps ?? [];
  const range = determineDateRange(conf.duration);
  const result = useDuckDBQuery(
    useProjectId(),
    `funnel-${simpleHash(JSON.stringify(conf))}`,
    buildFunnelQuery(
      steps,
      "events",
      range.start,
      range.end,
      conf.countingMode,
    ),
  );
  if (result.isPending) return <Spinner />;
  if (result.error)
    return <div role="alert">Error: {result.error.message}</div>;
  const series = (breakdown?.values ?? [null]).map((value, groupIndex) => {
    const raw =
      result.data?.find(
        (row) => !breakdown || Number(row.__breakdown_index) === groupIndex,
      ) ?? {};
    const values = Object.entries(raw)
      .filter(([key]) => key.endsWith("_count"))
      .map(([, value]) => numericResult.parse(value));
    const start = values[0] ?? 0;
    const points: FunnelPoint[] = steps.map((step, index) => {
      const value = values[index] ?? 0;
      const previous = values[index - 1] ?? value;
      const dropped = index === 0 ? 0 : Math.max(0, previous - value);
      const droppedFromStart = Math.max(0, start - value);
      const seconds = raw[`__step_${index}_seconds`];
      return {
        index,
        label: step.name,
        value,
        start,
        conversion: start > 0 ? (value / start) * 100 : null,
        conversionPrevious:
          index > 0 && previous > 0 ? (value / previous) * 100 : null,
        dropped,
        droppedFromStart,
        dropRate: index > 0 && previous > 0 ? (dropped / previous) * 100 : null,
        dropRateFromStart: start > 0 ? (droppedFromStart / start) * 100 : null,
        averageSeconds: seconds == null ? null : numericResult.parse(seconds),
      };
    });
    return { name: breakdown ? breakdownLabel(value) : countLabel, points };
  });
  if (series.every((entry) => entry.points.every((point) => point.value === 0)))
    return <ChartEmptyState insight={insight} />;
  return (
    <div className="space-y-4">
      <FunnelInsightChart
        metricUnit={insightMetricUnit(insight)}
        countLabel={countLabel}
        series={series}
        grouped={!!breakdown}
        label={insight.name ?? "Funnel"}
      />
      <div className="overflow-hidden rounded-xl border bg-background">
        <p className="px-4 py-2 text-xs text-muted-foreground sm:hidden">
          Swipe to see conversion, drop-off, and timing →
        </p>
        <Table
          className="min-w-[860px] table-fixed"
          aria-label="Funnel results"
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="w-1/4">
                Step
              </TableHead>
              <TableHead scope="col" className="w-28 text-right">
                {countLabel}
              </TableHead>
              <TableHead scope="col" className="w-36 text-right">
                From start
              </TableHead>
              <TableHead scope="col" className="w-28 text-right">
                Dropped off
              </TableHead>
              <TableHead scope="col" className="w-32 text-right">
                From previous
              </TableHead>
              <TableHead scope="col" className="w-36 text-right">
                Avg. time
              </TableHead>
            </TableRow>
          </TableHeader>
          {series.map((entry, groupIndex) => (
            <TableBody
              key={groupIndex}
              aria-label={entry.name}
              className="[&_tr:nth-child(even)]:bg-transparent"
            >
              {breakdown && (
                <TableRow className="border-y bg-muted/40 hover:bg-muted/40">
                  <TableHead
                    colSpan={6}
                    scope="rowgroup"
                    className="h-auto py-3 text-foreground"
                  >
                    <BreakdownLabel key={entry.name} name={entry.name} />
                  </TableHead>
                </TableRow>
              )}
              {entry.points.map((point, index) => {
                return (
                  <TableRow
                    key={`${groupIndex}-${steps[index]?.id}`}
                    className="border-b last:border-0"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground"
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 wrap-break-word font-medium">
                          {point.label}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <span className="inline-flex items-center gap-2">
                        <ArrowRight
                          aria-hidden="true"
                          className="size-3.5 text-emerald-600 dark:text-emerald-400"
                        />
                        {point.value.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="space-y-1.5">
                        <span>{funnelPercent(point.conversion)}</span>
                        <div
                          aria-hidden="true"
                          className="h-1 overflow-hidden rounded-full bg-muted"
                        >
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{
                              width: `${Math.min(100, Math.max(0, point.conversion ?? 0))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <div className="flex items-center justify-end gap-2">
                        <ArrowDownRight
                          aria-hidden="true"
                          className="size-3.5 text-orange-600 dark:text-orange-400"
                        />
                        {point.dropped.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {point.index === 0
                          ? "Entry step"
                          : `${funnelPercent(point.dropRate)} of previous`}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {funnelPercent(point.conversionPrevious)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="inline-flex items-center gap-2">
                        <Clock3
                          aria-hidden="true"
                          className="size-3.5 text-muted-foreground"
                        />
                        {funnelDuration(point.averageSeconds)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          ))}
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Conversion is shown from the start and the previous step. Drop-off
        counts are from the previous step. Average time measures first
        completion of each step from the previous step
        {conf.countingMode === "uniqueSessions"
          ? " within each session"
          : " for each user"}
        .
      </p>
    </div>
  );
}

export function FunnelInsightResults(
  props: Parameters<typeof UngroupedFunnelInsightResults>[0],
) {
  return (
    <ChartBreakdown insight={props.insight}>
      <UngroupedFunnelInsightResults {...props} />
    </ChartBreakdown>
  );
}
