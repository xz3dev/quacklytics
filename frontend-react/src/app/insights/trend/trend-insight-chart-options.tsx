import {useContext} from "react";
import {TrendInsightContext} from "@app/insights/insight-context.ts";

export function TrendInsightChartOptions() {
    const {data, updateFn} = useContext(TrendInsightContext)

    return (
        <>
            <div className="flex items-center gap-2">
                <div>Timeframe</div>
                <div>Aggregation Picker</div>
                <div className="flex-1"></div>
                <div>Actions</div>
            </div>
        </>
    )
}
