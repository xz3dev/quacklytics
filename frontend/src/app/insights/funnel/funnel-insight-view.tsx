import {useContext} from "react";
import {BaseInsightContext, FunnelInsightContext} from "@app/insights/insight-context.ts";
import {useUpdateInsight} from "@/services/insights.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {InsightSaveControls} from "@app/insights/insight-save-controls.tsx";
import {FunnelInsight} from "@/model/insights/funnel-insights.ts";
import {FunnelInsightResults} from "@app/insights/funnel/funnel-insight-results.tsx";
import {FunnelInsightSteps} from "@app/insights/funnel/funnel-insight-steps.tsx";
import {FunnelInsightResultOptions} from "@app/insights/funnel/funnel-insight-result-options.tsx";

export function FunnelInsightView() {
    const {data, update} = useContext(FunnelInsightContext)
    const {isChanged, original, updateWorkingCopy, readOnly} = useContext(BaseInsightContext)

    const updater = useUpdateInsight(useProjectId())

    const handleSave = async () => {
        if (!data) return
        const newInsight = await updater.mutateAsync(data)
        updateWorkingCopy?.(newInsight)
    }

    const handleDiscard = () => {
        if (!original) return
        update?.(original as FunnelInsight)
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
            {!readOnly && <FunnelInsightSteps />}
            {!readOnly && <FunnelInsightResultOptions/>}
            {data && (
                <FunnelInsightResults insight={data}/>
            )}
        </>
    )
}
