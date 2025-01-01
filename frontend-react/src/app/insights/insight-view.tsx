import {useInsight} from "@/services/insights.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {Spinner} from "@/components/spinner.tsx";
import {Insight} from "@/model/insight.ts";
import {TrendInsightContext} from "./insight-context";
import {TrendInsightView} from "@app/insights/trend/trend-insight-view.tsx";
import {useInsightId} from "@/hooks/use-insight-id.tsx";
import {useEffect, useState} from "react";

export function InsightView() {
    const insightid = useInsightId()
    const projectId = useProjectId()

    const insightData = useInsight(projectId, insightid)
    const [localWorkingCopy, updateWorkingCopy] = useState(insightData.data)

    useEffect(() => {
        if (insightData.data && !localWorkingCopy) {
            updateWorkingCopy(insightData.data)
        }
    }, [insightData.data])

    if (insightData.isLoading || insightData.isPending) return <Spinner/>
    if (insightData.error) return <div>Error: {insightData.error.message}</div>

    return (<>
        <TrendInsightContext.Provider value={{
            data: localWorkingCopy,
            update: (fn: (i: Insight) => void) => {
                if(!localWorkingCopy) return
                const copy = structuredClone(localWorkingCopy)
                fn(copy)
                updateWorkingCopy(copy);
            },
        }}>
            <div>ID: {insightid}</div>
            {renderInsight(insightData.data)}
        </TrendInsightContext.Provider>
    </>)
}

function renderInsight(insight: Insight) {
    switch (insight.type) {
        case 'Trend':
            return <TrendInsightView/>
        default:
            return <div>Unknown insight type: {insight.type}</div>
    }
}
