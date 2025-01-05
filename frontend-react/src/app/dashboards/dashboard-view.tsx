import {useDashboard} from "@/services/dashboards.ts";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {Spinner} from "@/components/spinner.tsx";
import {InsightCard} from "@app/insights/insight-card.tsx";
import {DashboardManageInsights} from "@app/dashboards/dashboard-manage-insights.tsx";

interface Props {
    dashboardId: number
}

export function DashboardView({dashboardId}: Props) {
    const projectId = useProjectId()
    const dashboardQuery = useDashboard(projectId, dashboardId)

    if (dashboardQuery.isLoading || dashboardQuery.isPending) return <Spinner/>
    if (dashboardQuery.error) return <div>Error: {dashboardQuery.error.message}</div>

    const dashboard = dashboardQuery.data
    const insights = dashboard.insights

    return (
        <div className="flex flex-col gap-4 my-4">
            <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{dashboard.name}</h1>
                <div className="flex-1"></div>
                <DashboardManageInsights dashboard={dashboard}/>
            </div>
            <div className="grid gap-4 py-4 grid-cols-2 items-stretch">
                {insights.map(insight => (
                    <InsightCard
                        key={insight.id}
                        insightId={insight.id}
                    />
                ))}
            </div>
        </div>
    )
}
