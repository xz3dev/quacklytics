import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  formatDuration,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subSeconds,
} from "date-fns";

import * as iso from "iso8601-duration";
import { UTCDate } from "@date-fns/utc";

export const predefinedRanges = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 24 hours", value: "PT24H" },
  { label: "Last 7 days", value: "P7D" },
  { label: "Last 14 days", value: "P14D" },
  { label: "Last 30 days", value: "P30D" },
  { label: "This month", value: "thisMonth" },
  { label: "Last month", value: "lastMonth" },
  { label: "Year to date", value: "yearToDate" },
  { label: "All time", value: "allTime" },
];

export type InsightDateRange = {
  label: string;
  value: string;
};

export const determineLabel = (range: string | undefined): string => {
  if (!range) range = "P30D";
  const predefined = predefinedRanges.find((r) => r.value === range)?.label;
  if (predefined) return predefined;

  if (range.startsWith("P")) {
    const d = iso.parse(range);
    return (
      "Last " +
      formatDuration(d, { format: ["years", "months", "days"], zero: false })
    );
  }

  const { start, end } = determineDateRange(range);
  return `${format(start, "LLL d, yyyy")} - ${format(end, "LLL d, yyyy")}`;
};

interface DateRange {
  start: UTCDate;
  end: UTCDate;
}

export const determinePreviousDateRange = (
  range: string | undefined,
): DateRange => {
  const { start, end } = determineDateRange(range);
  const length = end.getTime() - start.getTime() + 1;
  // A range running into the future has only data up to now, so its
  // predecessor stops at the same point to compare equal spans of time.
  const until = Math.min(end.getTime(), Date.now());
  return {
    start: new UTCDate(start.getTime() - length),
    // Filters include both endpoints, so the periods must not share a millisecond.
    end: new UTCDate(Math.min(until - length, start.getTime() - 1)),
  };
};

export const determineDateRange = (range: string | undefined): DateRange => {
  if (!range) {
    range = "P30D";
  }
  if (range.startsWith("P")) {
    const end = new UTCDate();
    const duration = iso.parse(range);
    if (!duration) throw Error("Invalid duration");
    const seconds = iso.toSeconds(duration, end);
    const start = subSeconds(end, seconds);

    // Calendar durations cover whole UTC days ending with today, so they keep
    // their bounds across reloads; time durations (e.g. PT24H) remain rolling
    // windows ending now.
    if (!duration.hours && !duration.minutes && !duration.seconds) {
      return {
        start: startOfDay(addDays(start, 1)),
        end: endOfDay(end),
      };
    }

    return {
      start,
      end,
    };
  }
  if (range === "today") {
    return {
      start: startOfDay(new UTCDate()),
      end: endOfDay(new UTCDate()),
    };
  }
  if (range === "yesterday") {
    const yesterday = subDays(new UTCDate(), 1);
    return {
      start: startOfDay(yesterday),
      end: endOfDay(yesterday),
    };
  }
  if (range === "thisMonth") {
    return {
      start: startOfMonth(new UTCDate()),
      end: endOfDay(new UTCDate()),
    };
  }
  if (range === "lastMonth") {
    const lastMonth = subMonths(new UTCDate(), 1);
    return {
      start: startOfDay(startOfMonth(lastMonth)),
      end: endOfDay(endOfMonth(lastMonth)),
    };
  }
  if (range === "yearToDate") {
    return {
      start: startOfDay(startOfYear(new UTCDate())),
      end: endOfDay(endOfDay(new UTCDate())),
    };
  }
  if (range === "allTime") {
    return {
      start: startOfDay(startOfMonth(new UTCDate(1000, 0, 1))),
      end: endOfDay(new UTCDate()),
    };
  }
  if (range.includes(" - ")) {
    // custom date range like this '2023-01-01 - 2023-01-10'
    const [start, end] = range.split(" - ");
    if (!start || !end) throw new Error("Invalid date range");
    return {
      start: startOfDay(new UTCDate(start)),
      end: endOfDay(new UTCDate(end)),
    };
  }
  throw Error("Invalid date range");
};
