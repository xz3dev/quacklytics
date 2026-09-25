import {useContext} from "react";
import {BaseInsightContext, BreakdownInsightContext} from "@app/insights/insight-context.ts";
import {useUpdateInsight} from "@/services/insights.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {InsightSaveControls} from "@app/insights/insight-save-controls.tsx";
import {BreakdownInsight} from "@/model/insights/breakdown-insight.ts";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {BreakdownInsightChart} from "@app/insights/breakdown/breakdown-insight-chart.tsx";
import {BreakdownInsightOptions} from "@app/insights/breakdown/breakdown-insight-options.tsx";

export function BreakdownInsightView() {
    const {data, update} = useContext(BreakdownInsightContext)
    const {isChanged, original, updateWorkingCopy, readOnly} = useContext(BaseInsightContext)
    const updater = useUpdateInsight(useProjectId())

    const handleSave = async () => {
        if (!data) return
        const newInsight = await updater.mutateAsync(data)
        updateWorkingCopy?.(newInsight)
    }

    const handleDiscard = () => {
        if (!original) return
        update?.(original as BreakdownInsight)
    }

    return (
        <>
            {!readOnly && <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold">{data?.name}</h2>
                <div className="flex-1"/>
                <div className={isChanged ? 'visible' : 'invisible'}>
                    <InsightSaveControls save={handleSave} discard={handleDiscard}/>
                </div>
            </div>}
            {!readOnly && <BreakdownInsightOptions/>}
            {data && (
                <Card>
                    <CardHeader>
                        <CardTitle>{data.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <BreakdownInsightChart insight={data} showTable={true}/>
                    </CardContent>
                </Card>
            )}
        </>
    )
}
