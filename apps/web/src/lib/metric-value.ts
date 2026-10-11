import type { Insight } from "@quacklytics/contracts";
import type { Aggregation } from "@/lib/aggregations";

const units = {
  user: { one: "user", other: "users", label: "Users" },
  session: { one: "session", other: "sessions", label: "Sessions" },
  event: { one: "event", other: "events", label: "Events" },
  transition: { one: "transition", other: "transitions", label: "Transitions" },
};

export type MetricUnit = keyof typeof units | "number";

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
});
const plurals = new Intl.PluralRules("en-US", { maximumFractionDigits: 6 });

export function formatMetricValue(value: number, unit: MetricUnit): string {
  const formatted = numberFormat.format(value);
  if (unit === "number") return formatted;
  const label = units[unit];
  return `${formatted} ${plurals.select(value) === "one" ? label.one : label.other}`;
}

export function metricLabel(unit: MetricUnit): string {
  return unit === "number" ? "Value" : units[unit].label;
}

function aggregationUnit(aggregation: Aggregation | undefined): MetricUnit {
  if (!aggregation || aggregation.function !== "COUNT") return "number";
  const { field, distinct } = aggregation;
  // Property names can collide with built-in columns. They carry no known unit.
  if (field.isProperty || field.name.startsWith("$.")) return "number";
  if (field.name === "id" || field.name === "*") return "event";
  if (!distinct) return "number";
  if (
    field.name === "person_id" ||
    field.name === "COALESCE(person_id, session_id)"
  )
    return "user";
  if (field.name === "session_id") return "session";
  return "number";
}

// A filter selects rows; the aggregation determines what the resulting number
// measures. Keep that distinction here rather than inferring units from labels.
export function insightMetricUnit(
  insight: Insight,
  seriesIndex = 0,
): MetricUnit {
  switch (insight.type) {
    case "Trend":
      return aggregationUnit(
        insight.config.trend.series?.[seriesIndex]?.query?.aggregations?.[0],
      );
    case "Value":
      return aggregationUnit(
        insight.config.value.series.query.aggregations?.[0],
      );
    case "Breakdown":
      return aggregationUnit(insight.config.breakdown.aggregation);
    case "Funnel":
      return insight.config.funnel.countingMode === "eventCount"
        ? "event"
        : insight.config.funnel.countingMode === "uniqueSessions"
          ? "session"
          : "user";
    case "Retention":
      // Like unique-user funnels, retention uses session identity for anonymous users.
      return "user";
    case "Path":
      // Paths count transitions, including repeated transitions by the same actor.
      return "transition";
    case "Map":
      return aggregationUnit(insight.config.map.aggregation);
  }
}
