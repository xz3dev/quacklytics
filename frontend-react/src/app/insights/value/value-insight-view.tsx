import {InsightSaveControls} from "@app/insights/insight-save-controls.tsx";
import {BaseInsightContext, ValueInsightContext} from "@app/insights/insight-context.ts";
import {useContext} from "react";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useUpdateInsight} from "@/services/insights.ts";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {ValueInsight} from "@/model/value-insight.ts";
import {ValueInsightChartOptions} from "@app/insights/value/value-insight-chart-options.tsx";
import {ValueInsightChart} from "@app/insights/value/value-insight-chart.tsx";
import {ValueInsightSeriesOptions} from "@app/insights/value/value-insight-series-options.tsx";


export function ValueInsightView() {
    const {data, update} = useContext(ValueInsightContext)
    const {isChanged, original, updateWorkingCopy, readOnly} = useContext(BaseInsightContext)

    const updater = useUpdateInsight(useProjectId())

    const handleSave = async () => {
        if (!data) return
        const newInsight = await updater.mutateAsync(data)
        updateWorkingCopy?.(newInsight)
    }

    const handleDiscard = () => {
        if (!original) return
        update?.(original as ValueInsight)
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
            {!readOnly && <ValueInsightSeriesOptions></ValueInsightSeriesOptions>}
            {!readOnly && <ValueInsightChartOptions/>}
            {data && (
                <Card>
                    <CardHeader>
                        <CardTitle>{data?.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ValueInsightChart insight={data}/>
                    </CardContent>
                </Card>
            )}
        </>
    )
}
