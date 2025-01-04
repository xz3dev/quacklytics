import {useContext} from "react";
import {TrendInsightContext} from "@app/insights/insight-context.ts";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {TimeBucket, timeBucketLabels} from "@/model/trend-insight.ts";
import DateRangePicker from "@/components/date-ranges/data-range-picker.tsx";
import {determineDateRange} from "@/model/InsightDateRange.ts";
import {format} from "date-fns";
import {CalendarRange} from "lucide-react";

export function TrendInsightChartOptions() {
    const {data, updateFn} = useContext(TrendInsightContext)

    const handleDateRangeChange = (range: string) => {
        updateFn?.((insight) => {
            insight.config.duration = range
        })
    }

    const handleBucketChange = (bucket: TimeBucket) => {
        updateFn?.((insight) => {
            insight.config.timeBucket = bucket
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

                <div className="text-sm text-muted-foreground">grouped by</div>

                <Select
                    value={data?.config.timeBucket}
                    onValueChange={(value: TimeBucket) => handleBucketChange(value)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select time bucket"/>
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(timeBucketLabels).map(([bucket, label]) => (
                            <SelectItem key={bucket} value={bucket}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="flex items-center gap-2 pl-4 text-xs text-muted-foreground">
                    <CalendarRange className="w-4 h-4 text-muted-foreground"></CalendarRange>
                    {renderRange(data?.config.duration)}
                </div>



                <div className="flex-1"></div>
            </div>
        </>
    )
}
