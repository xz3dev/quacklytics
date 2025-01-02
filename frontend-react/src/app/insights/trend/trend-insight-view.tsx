import {TrendInsightSeriesOptions} from "@app/insights/trend/trend-insight-series-options.tsx";
import {InsightSaveControls} from "@app/insights/insight-save-controls.tsx";
import {BaseInsightContext, TrendInsightContext} from "@app/insights/insight-context.ts";
import {useContext} from "react";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useUpdateInsight} from "@/services/insights.ts";
import {TrendInsightChart} from "@app/insights/trend/trend-insight-chart.tsx";
import {TrendInsightChartOptions} from "@app/insights/trend/trend-insight-chart-options.tsx";

interface Props {
    readOnly?: boolean
}

export function TrendInsightView({readOnly}: Props) {
    const {data, update} = useContext(TrendInsightContext)
    const {isChanged, original, updateWorkingCopy} = useContext(BaseInsightContext)

    const updater = useUpdateInsight(useProjectId())

    const handleSave = async () => {
        if (!data) return
        const newInsight = await updater.mutateAsync(data)
        updateWorkingCopy?.(newInsight)
    }

    const handleDiscard = () => {
        if (!original) return
        update?.(original)
    }

    return (
        <>
            {!readOnly && <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{data?.name}</h2>
                <div className="flex-1"></div>
                <div
                    className={isChanged ? 'visible' : 'invisible'}
                >
                    <InsightSaveControls
                        save={handleSave}
                        discard={handleDiscard}
                    />
                </div>
            </div>}
            {!readOnly && <TrendInsightSeriesOptions/>}
            {!readOnly && <TrendInsightChartOptions/>}
            {data && <TrendInsightChart insight={data}/>}
        </>
    )
}
