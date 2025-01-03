import {useContext} from "react";
import {TrendInsightContext} from "@app/insights/insight-context.ts";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {TimeBucket, timeBucketLabels} from "@/model/trend-insight.ts";

export function TrendInsightChartOptions() {
    const {data, updateFn} = useContext(TrendInsightContext)


    const handleBucketChange = (bucket: TimeBucket) => {
        updateFn?.((insight) => {
            insight.config.timeBucket = bucket
        })
    }
    return (
        <>
            <div className="flex items-center gap-2">
                <div>Timeframe</div>


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

                <div className="flex-1"></div>
                <div>Actions</div>
            </div>
        </>
    )
}
