import { useState } from "react";
import { CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useDuckDb } from "./duckdb-provider";

export function AnalyticsFreshness() {
  const db = useDuckDb();
  const { freshness, refreshedAt, error } = db.loadState();
  const [refreshing, setRefreshing] = useState(false);
  const ranges = (freshness?.files ?? []).flatMap((file) => {
    const start = Date.parse(file.start);
    const end = Date.parse(file.end);
    return Number.isFinite(start) && Number.isFinite(end) && end > start
      ? [{ start, end }]
      : [];
  });
  if (freshness?.availableStart && freshness.availableEnd)
    ranges.push({
      start: Date.parse(freshness.availableStart),
      end: Date.parse(freshness.availableEnd),
    });
  const availableStart = ranges.reduce(
    (min, range) => Math.min(min, range.start),
    Infinity,
  );
  const availableEnd = ranges.reduce(
    (max, range) => Math.max(max, range.end),
    -Infinity,
  );
  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  const failed = Boolean(error || freshness?.exportError);
  const updating = refreshing || !freshness || freshness.pending;
  const label = failed
    ? "Needs attention"
    : updating
      ? "Updating"
      : "Up to date";
  const Icon = failed ? CircleAlert : updating ? LoaderCircle : null;
  const color = failed
    ? "bg-amber-100 text-amber-800 hover:bg-amber-200 hover:text-amber-900 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900 dark:hover:text-amber-200"
    : updating
      ? "bg-blue-100 text-blue-800 hover:bg-blue-200 hover:text-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 dark:hover:text-blue-200"
      : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 hover:text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900 dark:hover:text-emerald-200";

  async function refresh() {
    setRefreshing(true);
    try {
      await db.retry();
    } catch {
      // The shared load state exposes the error and keeps the last loaded data.
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <SidebarMenuButton
          aria-label={`Analytics data: ${label}`}
          tooltip={`Analytics data: ${label}`}
          className={color}
        >
          {Icon ? (
            <Icon
              aria-hidden="true"
              strokeWidth={2.5}
              className={
                updating && !failed
                  ? "animate-spin motion-reduce:animate-none"
                  : ""
              }
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-4 shrink-0 items-center justify-center"
            >
              <span className="relative flex size-3">
                <span className="absolute inline-flex size-full animate-soft-ping rounded-full bg-emerald-500 motion-reduce:hidden" />
                <span className="relative inline-flex size-full rounded-full bg-emerald-500" />
              </span>
            </span>
          )}
          <span>{label}</span>
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={12}
        aria-label="Analytics freshness"
      >
        <div className="space-y-3">
          {(error ||
            freshness?.exportError ||
            refreshing ||
            !freshness ||
            freshness.pending) && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {error
                ? "Analytics refresh failed. Showing last loaded data."
                : freshness?.exportError
                  ? "Event export failed. Retrying automatically."
                  : refreshing
                    ? "Checking for new analytics data…"
                    : "Loading analytics…"}
            </p>
          )}
          <div className="space-y-1 text-xs" aria-label="Available timeframe">
            {ranges.length ? (
              <div>
                <time dateTime={new Date(availableStart).toISOString()}>
                  {formatDate(availableStart)}
                </time>
                {" – "}
                <time dateTime={new Date(availableEnd - 1).toISOString()}>
                  {formatDate(availableEnd - 1)}
                </time>
                <span className="text-muted-foreground"> (UTC)</span>
              </div>
            ) : (
              <div className="text-muted-foreground">No data available yet</div>
            )}
          </div>
          {refreshedAt && (
            <p className="text-xs text-muted-foreground">
              Last checked{" "}
              <time dateTime={refreshedAt}>
                {new Date(refreshedAt).toLocaleTimeString()}
              </time>
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={refreshing}
            onClick={() => void refresh()}
          >
            <RefreshCw
              aria-hidden="true"
              className={
                refreshing ? "animate-spin motion-reduce:animate-none" : ""
              }
            />
            {refreshing ? "Refreshing…" : "Refresh data"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
