import { ChartEmptyState } from "@/components/chart-empty-state";
import type { ReactNode } from "react";
import { z } from "zod";
import type { Insight } from "@/model/insights/insight";
import { useProjectId } from "@/hooks/use-project-id";
import { useDuckDBQuery } from "@/services/duck-db-queries";
import {
  ChartBreakdownContext,
  breakdownExpression,
} from "@/lib/chart-breakdown";
import {
  determineDateRange,
  determinePreviousDateRange,
} from "@/model/insights/insight-date-range";
import { FieldSelector } from "./field-selector";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ChartBreakdownOptions({
  insight,
  onChange,
}: {
  insight: Insight;
  onChange: (insight: Insight) => void;
}) {
  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2"
      aria-label="Chart breakdown"
    >
      <span className="text-sm text-muted-foreground">breakdown by</span>
      <div className="flex min-w-0 items-center gap-1">
        <div className="w-[160px]">
          <FieldSelector
            {...(insight.breakdownBy ? { value: insight.breakdownBy } : {})}
            placeholder="Select breakdown field"
            ariaLabel="Break down by"
            onChange={(field) => onChange({ ...insight, breakdownBy: field })}
          />
        </div>
        {insight.breakdownBy && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove breakdown"
            onClick={() => {
              const copy = structuredClone(insight);
              delete copy.breakdownBy;
              onChange(copy);
            }}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ChartBreakdown({
  insight,
  children,
}: {
  insight: Insight;
  children: ReactNode;
}) {
  if (!insight.breakdownBy) return children;
  return (
    <GroupedChart insight={insight} field={insight.breakdownBy}>
      {children}
    </GroupedChart>
  );
}

function GroupedChart({
  insight,
  field,
  children,
}: {
  insight: Insight;
  field: NonNullable<Insight["breakdownBy"]>;
  children: ReactNode;
}) {
  const duration = insightDuration(insight);
  const range = determineDateRange(duration);
  const start =
    insight.type === "Value"
      ? determinePreviousDateRange(duration).start
      : range.start;
  const result = useDuckDBQuery(
    useProjectId(),
    `breakdown-values-${insight.id}`,
    {
      sql: `SELECT ${breakdownExpression(field)} AS breakdown_value, COUNT(*) AS event_count FROM events WHERE timestamp BETWEEN epoch_ms(?::BIGINT) AND epoch_ms(?::BIGINT) GROUP BY breakdown_value ORDER BY event_count DESC, breakdown_value ASC NULLS LAST LIMIT 21`,
      params: [start.getTime(), range.end.getTime()],
    },
  );
  if (result.isPending) return <p>Loading breakdown…</p>;
  if (result.error) return <p role="alert">{result.error.message}</p>;
  const rows = z
    .array(z.object({ breakdown_value: z.string().nullable() }))
    .parse(result.data);
  if (!rows.length) return <ChartEmptyState insight={insight} />;
  return (
    <div className="space-y-6">
      {rows.length > 20 && (
        <p className="text-sm text-muted-foreground">
          Showing the 20 most frequent values in this date range.
        </p>
      )}
      <ChartBreakdownContext.Provider
        value={{
          field,
          values: rows.slice(0, 20).map((row) => row.breakdown_value),
        }}
      >
        {children}
      </ChartBreakdownContext.Provider>
    </div>
  );
}

function insightDuration(insight: Insight): string {
  switch (insight.type) {
    case "Trend":
      return insight.config.trend.duration;
    case "Value":
      return insight.config.value.duration;
    case "Funnel":
      return insight.config.funnel.duration;
    case "Breakdown":
      return insight.config.breakdown.duration;
    case "Retention":
      return insight.config.retention.duration;
    case "Path":
      return insight.config.path.duration;
    case "Map":
      return insight.config.map.duration;
  }
}
