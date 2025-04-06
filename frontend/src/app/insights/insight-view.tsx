import {useInsight} from "@/services/insights.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {Spinner} from "@/components/spinner.tsx";
import {Insight} from "@/model/insights/insight.ts";
import {BaseInsightContext, TrendInsightContext, ValueInsightContext} from "@app/insights/insight-context";
import {TrendInsightView} from "@app/insights/trend/trend-insight-view.tsx";
import {useEffect, useState} from "react";
import {TrendInsight} from "@/model/insights/trend-insight.ts";
import {ValueInsight} from "@/model/insights/value-insight.ts";
import {ValueInsightView} from "@app/insights/value/value-insight-view.tsx";

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
            case 'Value':
                return (
                    <ValueInsightContext.Provider value={{
                        data: localWorkingCopy as ValueInsight,
                        update: updateWorkingCopy,
                        updateFn: (fn: (i: ValueInsight) => void) => {
                            if (!localWorkingCopy) return
                            const copy = structuredClone(localWorkingCopy)
                            fn(copy as ValueInsight)
                            updateWorkingCopy(copy);
                        },
                    }}>
                        <ValueInsightView/>
                    </ValueInsightContext.Provider>
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
