import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  TimeBucket,
  timeBucketData,
  timeBuckets,
} from "@/model/insights/trend-insight.ts";
import DateRangePicker from "@/components/date-ranges/data-range-picker.tsx";
import { determineDateRange } from "@/model/insights/insight-date-range.ts";
import { format } from "date-fns";
import { CalendarRange } from "lucide-react";

interface Props {
  duration?: string;
  timeBucket?: TimeBucket | undefined;
  onDurationChange: (duration: string) => void;
  onBucketChange?: ((bucket: TimeBucket) => void) | undefined;
  children?: ReactNode;
}

export function InsightTimeControls({
  duration,
  timeBucket,
  onDurationChange,
  onBucketChange,
  children,
}: Props) {
  const range = duration ? determineDateRange(duration) : undefined;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangePicker
        value={duration}
        placeholder="Insight timeframes"
        onChange={(range) => onDurationChange(range.value)}
      />
      {onBucketChange && (
        <>
          <div className="text-sm text-muted-foreground">grouped by</div>
          <Select
            value={timeBucket ?? ""}
            onValueChange={(value) => {
              const bucket = timeBuckets.find((bucket) => bucket === value);
              if (bucket) onBucketChange(bucket);
            }}
          >
            <SelectTrigger className="w-[100px]" aria-label="Time grouping">
              <SelectValue placeholder="Insight groupings" />
            </SelectTrigger>
            <SelectContent>
              {timeBuckets.map((bucket) => (
                <SelectItem
                  key={bucket}
                  value={bucket}
                  disabled={
                    duration
                      ? !timeBucketData[bucket].canActivate(duration)
                      : false
                  }
                >
                  {timeBucketData[bucket].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      {children}
      {range && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarRange aria-hidden="true" className="w-4 h-4 shrink-0" />
          <span aria-label="Effective date range">
            {format(range.start, "MMM d, yyyy")} -{" "}
            {format(range.end, "MMM d, yyyy")}
          </span>
        </div>
      )}
    </div>
  );
}
