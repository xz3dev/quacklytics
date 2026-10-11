import { REFRESH_INTERVAL_MS } from "@/client/analytics/files";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/tailwind";
import { useDuckDb } from "./duckdb-provider";

export function LiveIndicator() {
  const db = useDuckDb();
  const { refreshedAt, error } = db.loadState();
  const status = error ? "offline" : refreshedAt ? "live" : "connecting";
  const label =
    status === "offline"
      ? "Reconnecting"
      : status === "live"
        ? "Live"
        : "Connecting";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="status"
          aria-label={`Event data: ${label}`}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
            status === "live" &&
              "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
            status === "connecting" &&
              "border-border bg-muted text-muted-foreground",
            status === "offline" &&
              "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
          )}
        >
          <span aria-hidden="true" className="relative flex size-2">
            {status === "live" && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                status === "live" && "bg-emerald-500",
                status === "connecting" && "bg-muted-foreground",
                status === "offline" && "bg-amber-500",
              )}
            />
          </span>
          {label}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left">
        {status === "offline"
          ? "Could not check for new events. Retrying automatically."
          : `New events appear automatically every ${REFRESH_INTERVAL_MS / 1000}s.`}
        {refreshedAt && (
          <>
            {" "}
            Last checked{" "}
            <time dateTime={refreshedAt}>
              {new Date(refreshedAt).toLocaleTimeString()}
            </time>
            .
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
