import { defaultInsights } from "@quacklytics/contracts";
import { Insight } from "@/model/insights/insight.ts";
import { Field } from "@/model/filters.ts";
import { determineDateRange } from "@/model/insights/insight-date-range.ts";
import {
  Duration,
  add,
  differenceInDays,
  startOfMonth,
} from "date-fns";
import { UTCDate } from "@date-fns/utc";

export type TrendInsight = Extract<Insight, { type: "Trend" }>;

export type TrendInsightConfig = TrendInsight["config"]["trend"];

export const trendSeriesTypes = ["line", "bar"] as const;
export type TrendSeriesType = (typeof trendSeriesTypes)[number];

export type TrendSeries = NonNullable<TrendInsightConfig["series"]>[number];

export const newTrendInsight = defaultInsights.Trend;

export const trendAggregationFunctions = [
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
] as const;
export type TrendAggregationFunction =
  (typeof trendAggregationFunctions)[number];

export interface TrendAggregation {
  function: TrendAggregationFunction;
  field: Field;
  alias: "result_value";
  distinct?: boolean;
}

export const requireMinDays = (
  minDays: number,
): ((range: string) => boolean) => {
  return (range: string) => {
    const dateRange = determineDateRange(range);
    return differenceInDays(dateRange.end, dateRange.start) >= minDays;
  };
};

export const requireMaxDays = (
  maxDays: number,
): ((range: string) => boolean) => {
  return (range: string) => {
    const dateRange = determineDateRange(range);
    return differenceInDays(dateRange.end, dateRange.start) <= maxDays;
  };
};

export const timeBuckets = ["Hourly", "Daily", "Weekly", "Monthly"] as const;
export type TimeBucket = (typeof timeBuckets)[number];
export const timeBucketData: {
  [key in TimeBucket]: TimeBucketData;
} = {
  Hourly: {
    label: "Hour",
    canActivate: requireMaxDays(2),
    interval: {
      hours: 1,
    },
  },
  Daily: {
    label: "Day",
    canActivate: requireMinDays(2),
    interval: {
      days: 1,
    },
  },
  Weekly: {
    label: "Week",
    canActivate: requireMinDays(2),
    interval: {
      weeks: 1,
    },
  },
  Monthly: {
    label: "Month",
    canActivate: requireMinDays(2),
    interval: {
      months: 1,
    },
  },
};

interface TimeBucketData {
  label: string;
  canActivate: (dateRange: string) => boolean;
  interval: Duration;
}

/**
 * Lists every bucket start the selected range covers, so charts span the whole
 * range instead of only the buckets that contain data. Mirrors DuckDB's
 * `time_bucket`: month buckets snap to the first of the month, other buckets
 * align to the range start. "All time" begins at the earliest data bucket.
 */
export function trendBuckets(
  timeBucket: TimeBucket,
  duration: string,
  dataBuckets: readonly string[],
): string[] {
  const range = determineDateRange(duration);
  // ISO timestamps sort chronologically as strings.
  const sorted = [...dataBuckets].sort();
  const earliest = sorted[0];
  const start =
    duration !== "allTime"
      ? range.start
      : earliest
        ? new UTCDate(earliest)
        : range.end;
  const first = timeBucket === "Monthly" ? startOfMonth(start) : start;
  const buckets = new Set<string>(sorted);
  for (
    let cursor = first;
    cursor <= range.end;
    cursor = add(cursor, timeBucketData[timeBucket].interval)
  ) {
    buckets.add(cursor.toISOString());
  }
  // Returned buckets stay included, even if they fall outside the range.
  return [...buckets].sort();
}
