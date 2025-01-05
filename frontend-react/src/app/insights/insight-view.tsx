import {useInsight} from "@/services/insights.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {Spinner} from "@/components/spinner.tsx";
import {Insight} from "@/model/insight.ts";
import {BaseInsightContext, TrendInsightContext} from "@app/insights/insight-context";
import {TrendInsightView} from "@app/insights/trend/trend-insight-view.tsx";
import {useEffect, useState} from "react";
import {TrendInsight} from "@/model/trend-insight.ts";

interface Props {
    insightId: number
    readOnly?: boolean
}

export function InsightView({insightId, readOnly}: Props) {
    const projectId = useProjectId()

    const insightData = useInsight(projectId, insightId)
    const [localWorkingCopy, updateWorkingCopy] = useState(insightData.data)

    useEffect(() => {
        if (insightData.data && !localWorkingCopy) {
            updateWorkingCopy(insightData.data)
        }
    }, [insightData.data])

    if (insightData.isLoading || insightData.isPending) return <Spinner/>
    if (insightData.error) return <div>Error: {insightData.error.message}</div>

    const isChanged = JSON.stringify(insightData.data) !== JSON.stringify(localWorkingCopy)

    const renderInsight = (insight: Insight) => {
        switch (insight.type) {
            case 'Trend':
                return (
                    <TrendInsightContext.Provider value={{
                        data: localWorkingCopy as TrendInsight,
                        update: updateWorkingCopy,
                        updateFn: (fn: (i: TrendInsight) => void) => {
                            if (!localWorkingCopy) return
                            const copy = structuredClone(localWorkingCopy)
                            fn(copy as TrendInsight)
                            updateWorkingCopy(copy);
                        },
                    }}>
                        <TrendInsightView/>
                    </TrendInsightContext.Provider>
                )
            default:
                return <div>Unknown insight type: {insight.type}</div>
        }
    }

    return (<>
        <BaseInsightContext.Provider value={{isChanged, original: insightData.data, updateWorkingCopy, readOnly}}>
            {renderInsight(insightData.data)}
        </BaseInsightContext.Provider>
    </>)
}
