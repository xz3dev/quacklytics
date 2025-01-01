import {TrendInsightOptions} from "@app/insights/trend/trend-insight-options.tsx";
import {InsightSaveControls} from "@app/insights/insight-save-controls.tsx";
import {BaseInsightContext, TrendInsightContext} from "@app/insights/insight-context.ts";
import {useContext} from "react";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useUpdateInsight} from "@/services/insights.ts";

interface Props {
    readOnly?: boolean
}

export function TrendInsightView({readOnly}: Props) {
    const {data, update} = useContext(TrendInsightContext)
    const {isChanged, original, updateWorkingCopy} = useContext(BaseInsightContext)

    const updater = useUpdateInsight(useProjectId())

    const handleSave = async () => {
        if(!data) return
        const newInsight = await updater.mutateAsync(data)
        updateWorkingCopy?.(newInsight)
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
                        save={() => handleSave()}
                        discard={() => {
                            if(!original) return
                            update?.(original)
                        }}
                    />
                </div>
            </div>}
            {!readOnly && <TrendInsightOptions/>}
        </>
    )
}
