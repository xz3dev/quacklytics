import {useContext} from "react";
import {ValueInsightContext} from "@app/insights/insight-context.ts";
import {determineDateRange} from "@/model/InsightDateRange.ts";
import {format} from "date-fns";
import DateRangePicker from "@/components/date-ranges/data-range-picker.tsx";
import {CalendarRange} from "lucide-react";

export function ValueInsightChartOptions() {
    const {data, updateFn} = useContext(ValueInsightContext)

    const handleDateRangeChange = (range: string) => {
        updateFn?.((insight) => {
            insight.config.duration = range
        })
    }

    const renderRange = (range: string | undefined) => {
        if(!range) return <div>All time</div>
        const {start, end} = determineDateRange(range)
        return <span>{format(start, 'yyyy-MM-dd HH:mm')} - {format(end, 'yyyy-MM-dd HH:mm')}</span>
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <DateRangePicker
                    onChange={(range) => handleDateRangeChange(range.value)}
                    value={data?.config.duration}
                />

                <div className="flex items-center gap-2 pl-4 text-xs text-muted-foreground">
                    <CalendarRange className="w-4 h-4 text-muted-foreground"></CalendarRange>
                    {renderRange(data?.config.duration)}
                </div>

                <div className="flex-1"></div>
            </div>
        </>
    )
}
