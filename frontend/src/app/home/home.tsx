import {InsightsList} from "../insights/insight-list";
import {DashboardView} from "@app/dashboards/dashboard-view.tsx";
import {useDashboards} from "@/services/dashboards.ts";
import {Spinner} from "@/components/spinner.tsx";
import {useProjectId} from "@/hooks/use-project-id.tsx";

export function Home() {
    const projectId = useProjectId()
    const dashboardsQuery = useDashboards(projectId)
    if(dashboardsQuery.isLoading || dashboardsQuery.isPending) return <Spinner/>
    if(dashboardsQuery.error) return <div>Error: {dashboardsQuery.error.message}</div>
    const home = dashboardsQuery.data.find(d => d.home)?.id
    return (
        <div className="flex flex-col gap-4">
            <InsightsList
                title={"Favorite Insights"}
                filter={(i) => i.favorite}
                createAsFavorite={true}
            />
            {home && <DashboardView dashboardId={home} readOnly={true}/>}
        </div>
    )
}
