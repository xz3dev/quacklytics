import {useContext} from "react";
import {TrendInsightContext} from "@app/insights/insight-context.ts";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {TimeBucket, timeBucketLabels} from "@/model/trend-insight.ts";
import DateRangePicker from "@/components/date-ranges/data-range-picker.tsx";
import {determineDateRange} from "@/model/InsightDateRange.ts";
import {format} from "date-fns";

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
        return <span>{format(start, 'LLL d, yyyy')} - {format(end, 'LLL d, yyyy')}</span>
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <DateRangePicker onChange={(range) => handleDateRangeChange(range.value)}/>

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

                <div className="pl-4 text-xs text-muted-foreground">
                    {renderRange(data?.config.duration)}
                </div>



                <div className="flex-1"></div>
            </div>
        </>
    )
}
