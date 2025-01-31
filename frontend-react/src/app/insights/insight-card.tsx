import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useInsight} from "@/services/insights.ts";
import {Spinner} from "@/components/spinner.tsx";
import {Insight} from "@/model/insight.ts";
import {TrendInsightChart} from "@app/insights/trend/trend-insight-chart.tsx";
import {TrendInsight} from "@/model/trend-insight.ts";
import {TrendInsightContext, ValueInsightContext} from "./insight-context";
import {ProjectLink} from "@/components/project-link.tsx";
import {ValueInsight} from "@/model/value-insight.ts";
import {ValueInsightChart} from "@app/insights/value/value-insight-chart.tsx";

interface Props {
    insightId: number
}

export function InsightCard({insightId}: Props) {
    const projectId = useProjectId()
    const insightData = useInsight(projectId, insightId)

    if (insightData.status === 'pending') return emptyCard('Loading...', <Spinner/>)
    if (insightData.status === 'error') return emptyCard('Error', <div>Error: {insightData.error.message}</div>)

    const insight = insightData.data

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    <ProjectLink to={`/insights/${insight.id}`}>
                        {insight.name}
                    </ProjectLink>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {renderInsight(insight)}
            </CardContent>
        </Card>
    )
}

function renderInsight(insight: Insight) {
    switch (insight.type) {
        case 'Trend':
            return (
                <TrendInsightContext.Provider value={{
                    data: insight as TrendInsight,
                    update: () => undefined,
                    updateFn: () => undefined,
                }}>
                    <TrendInsightChart insight={insight as TrendInsight}/>
                </TrendInsightContext.Provider>
            )
        case 'Value':
            return (
                <ValueInsightContext.Provider value={{
                    data: insight as ValueInsight,
                    update: () => undefined,
                    updateFn: () => undefined,
                }}>
                    <ValueInsightChart insight={insight as ValueInsight}/>
                </ValueInsightContext.Provider>
            )
        default:
            return <div>Unknown insight type: {insight.type}</div>
    }
}

function emptyCard(title: string, children: React.ReactNode) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {children}
            </CardContent>
        </Card>
    )
}
