import {useContext} from "react";
import {BaseInsightContext, PathInsightContext} from "@app/insights/insight-context.ts";
import {useUpdateInsight} from "@/services/insights.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {InsightSaveControls} from "@app/insights/insight-save-controls.tsx";
import {PathInsight} from "@/model/insights/path-insight.ts";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card.tsx";
import {PathInsightChart} from "@app/insights/path/path-insight-chart.tsx";
import {PathInsightOptions} from "@app/insights/path/path-insight-options.tsx";

export function PathInsightView() {
    const {data, update} = useContext(PathInsightContext)
    const {isChanged, original, updateWorkingCopy, readOnly} = useContext(BaseInsightContext)
    const updater = useUpdateInsight(useProjectId())

    const handleSave = async () => {
        if (!data) return
        const newInsight = await updater.mutateAsync(data)
        updateWorkingCopy?.(newInsight)
    }

    const handleDiscard = () => {
        if (!original) return
        update?.(original as PathInsight)
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
            {!readOnly && <PathInsightOptions/>}
            {data && (
                <Card>
                    <CardHeader>
                        <CardTitle>{data.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <PathInsightChart insight={data}/>
                    </CardContent>
                </Card>
            )}
        </>
    )
}
