import {useContext} from "react";
import {FunnelInsightContext} from "@app/insights/insight-context.ts";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
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

    const handleConversionWindowChange = (window: string) => {
        updateFn?.((insight) => {
            insight.config.funnel.conversionWindow = window;
        });
    };

    const renderRange = (range: string | undefined) => {
        if(!range) range = 'P30D';
        const {start, end} = determineDateRange(range);
        return <span>{format(start, 'yyyy-MM-dd HH:mm')} - {format(end, 'yyyy-MM-dd HH:mm')}</span>;
    };

    // Conversion window options
    const conversionWindows = [
        { value: "P1D", label: "1 day" },
        { value: "P3D", label: "3 days" },
        { value: "P7D", label: "7 days" },
        { value: "P14D", label: "14 days" },
        { value: "P30D", label: "30 days" },
        { value: "P60D", label: "60 days" },
        { value: "P90D", label: "90 days" }
    ];

    return (
        <>

            <div className="flex items-center gap-2 mt-4">
                <DateRangePicker
                    onChange={(range) => handleDateRangeChange(range.value)}
                    value={data?.config.funnel.duration}
                />

                <div className="text-sm text-muted-foreground">conversion window</div>

                <Select
                    value={data?.config.funnel.conversionWindow}
                    onValueChange={(value) => handleConversionWindowChange(value)}
                >
                    <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Select window"/>
                    </SelectTrigger>
                    <SelectContent>
                        {conversionWindows.map((window) => (
                            <SelectItem
                                key={window.value}
                                value={window.value}
                            >
                                {window.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex items-center gap-2 pl-4 text-xs text-muted-foreground">
                    <CalendarRange className="w-4 h-4 text-muted-foreground"></CalendarRange>
                    {renderRange(data?.config.funnel.duration)}
                </div>
            </div>
        </>
    );
}
