import { defaultInsights } from "@quacklytics/contracts";
import { Insight } from "@/model/insights/insight.ts";
import { Field } from "@/model/filters.ts";
import { determineDateRange } from "@/model/insights/insight-date-range.ts";
import { Duration, intervalToDuration } from "date-fns";

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
    const duration = intervalToDuration({
      start: dateRange.start,
      end: dateRange.end,
    });
    return (duration?.days ?? 0) >= minDays;
  };
};

export const requireMaxDays = (
  maxDays: number,
): ((range: string) => boolean) => {
  return (range: string) => {
    const dateRange = determineDateRange(range);
    const duration = intervalToDuration({
      start: dateRange.start,
      end: dateRange.end,
    });
    return (duration?.days ?? 0) <= maxDays;
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
