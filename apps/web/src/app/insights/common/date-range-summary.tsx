import DateRangePicker from "@/components/date-ranges/data-range-picker.tsx";
import { CalendarRange } from "lucide-react";
import { determineDateRange } from "@/model/insights/insight-date-range.ts";
import { format } from "date-fns";

interface Props {
  value?: string;
  onChange: (value: string) => void;
}

export function DateRangeSummary({ value, onChange }: Props) {
  const range = value ?? "P30D";
  const { start, end } = determineDateRange(range);

  return (
    <div className="flex items-center gap-2">
      <DateRangePicker
        onChange={(range) => onChange(range.value)}
        value={range}
      />
      <div className="flex items-center gap-2 pl-2 text-xs text-muted-foreground">
        <CalendarRange className="w-4 h-4 text-muted-foreground" />
        <span>
          {format(start, "yyyy-MM-dd HH:mm")} -{" "}
          {format(end, "yyyy-MM-dd HH:mm")}
        </span>
      </div>
    </div>
  );
}
