import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useInsight} from "@/services/insights.ts";
import {Spinner} from "@/components/spinner.tsx";
import {Insight} from "@/model/insights/insight.ts";
import {TrendInsightChart} from "@app/insights/trend/trend-insight-chart.tsx";
import {TrendInsight} from "@/model/insights/trend-insight.ts";
import {
    BreakdownInsightContext,
    FunnelInsightContext,
    PathInsightContext,
    RetentionInsightContext,
    TrendInsightContext,
    ValueInsightContext
} from "./insight-context";
import {ProjectLink} from "@/components/project-link.tsx";
import {ValueInsight} from "@/model/insights/value-insight.ts";
import {ValueInsightChart} from "@app/insights/value/value-insight-chart.tsx";
import {FunnelInsight} from "@/model/insights/funnel-insights.ts";
import {FunnelInsightResults} from "@app/insights/funnel/funnel-insight-results.tsx";
import {BreakdownInsight} from "@/model/insights/breakdown-insight.ts";
import {BreakdownInsightChart} from "@app/insights/breakdown/breakdown-insight-chart.tsx";
import {RetentionInsight} from "@/model/insights/retention-insight.ts";
import {RetentionInsightChart} from "@app/insights/retention/retention-insight-chart.tsx";
import {PathInsight} from "@/model/insights/path-insight.ts";
import {PathInsightChart} from "@app/insights/path/path-insight-chart.tsx";

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
        <Card className={"h-full"}>
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
        case 'Funnel':
            return (
                <FunnelInsightContext.Provider value={{
                    data: insight as FunnelInsight,
                    update: () => undefined,
                    updateFn: () => undefined,
                }}>
                    <FunnelInsightResults insight={insight as FunnelInsight} layoutDirection="vertical"/>
                </FunnelInsightContext.Provider>
            )
        case 'Breakdown':
            return (
                <BreakdownInsightContext.Provider value={{
                    data: insight as BreakdownInsight,
                    update: () => undefined,
                    updateFn: () => undefined,
                }}>
                    <BreakdownInsightChart insight={insight as BreakdownInsight} showTable={false}/>
                </BreakdownInsightContext.Provider>
            )
        case 'Retention':
            return (
                <RetentionInsightContext.Provider value={{
                    data: insight as RetentionInsight,
                    update: () => undefined,
                    updateFn: () => undefined,
                }}>
                    <RetentionInsightChart insight={insight as RetentionInsight}/>
                </RetentionInsightContext.Provider>
            )
        case 'Path':
            return (
                <PathInsightContext.Provider value={{
                    data: insight as PathInsight,
                    update: () => undefined,
                    updateFn: () => undefined,
                }}>
                    <PathInsightChart insight={insight as PathInsight}/>
                </PathInsightContext.Provider>
            )
        default:
            return <div>Unknown insight type: {insight.type}</div>
    }
}

function emptyCard(title: string, children: React.ReactNode) {
    return (
        <Card className={"h-full"}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {children}
            </CardContent>
        </Card>
    )
}
