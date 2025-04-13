import {useContext} from "react";
import {FunnelInsightContext} from "@app/insights/insight-context.ts";
import DateRangePicker from "@/components/date-ranges/data-range-picker.tsx";
import {determineDateRange} from "@/model/insights/insight-date-range.ts";
import {format} from "date-fns";
import {CalendarRange} from "lucide-react";

export function FunnelInsightResultOptions() {
    const {data, updateFn} = useContext(FunnelInsightContext);

    const handleDateRangeChange = (range: string) => {
        updateFn?.((insight) => {
            insight.config.funnel.duration = range;
        });
    };

    const renderRange = (range: string | undefined) => {
        if(!range) range = 'P30D';
        const {start, end} = determineDateRange(range);
        return <span>{format(start, 'yyyy-MM-dd HH:mm')} - {format(end, 'yyyy-MM-dd HH:mm')}</span>;
    };

    return (
        <>

            <div className="flex items-center gap-2 mt-4">
                <DateRangePicker
                    onChange={(range) => handleDateRangeChange(range.value)}
                    value={data?.config.funnel.duration}
                />

                <div className="flex items-center gap-2 pl-4 text-xs text-muted-foreground">
                    <CalendarRange className="w-4 h-4 text-muted-foreground"></CalendarRange>
                    {renderRange(data?.config.funnel.duration)}
                </div>
            </div>
        </>
    );
}
