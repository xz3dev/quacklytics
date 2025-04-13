import {useProjectId} from "./use-project-id";
import {ChartLine, Database, Home, LayoutDashboard, ListTree, LucideIcon, Settings2, Filter} from "lucide-react";
import {useMatch} from "react-router";
import {useMemo} from "react";

export function useSidebarData(): SidebarData {
    const projectId = useProjectId()
    const isHome = useMatch('/app/:projectid')
    const isInsights = useMatch('/app/:projectid/insights')
    const isInsight = useMatch('/app/:projectid/insights/:insightid')
    const isDashboards = useMatch('/app/:projectid/dashboards')
    const isDashboard = useMatch('/app/:projectid/dashboards/:dashboardid')
    const isEvents = useMatch('/app/:projectid/events')
    const isData = useMatch('/app/:projectid/data')
    // const isRealTimeEvents = useMatch('/app/:projectid/data/realtime')
    const isSettings = useMatch('/app/:projectid/settings')
    const isQueryTester = useMatch('/app/:projectid/queries')
    const isAnalytics = !!isHome || !!isEvents || !!isInsights || !!isInsight || !!isDashboards || !!isDashboard || !!isData || !!isSettings

    const breadcrumbs = useMemo(() => {
        const items: BreadcrumbItem[] = []

        if (isAnalytics) {
            items.push({title: 'Analytics', url: `/app/${projectId}`})
        }

        if (isInsights || isInsight) {
            items.push({title: 'Insights', url: `/app/${projectId}/insights`, isActive: !isInsight})
        }

        if (isInsight) {
            items.push({
                title: 'Insight',
                url: `/app/${projectId}/insights/${isInsight.params.insightid}`,
                isActive: true
            })
        }

        if (isDashboard || isDashboards) {
            items.push({title: 'Dashboards', url: `/app/${projectId}/dashboards`, isActive: !isInsight})
        }

        if (isDashboard) {
            items.push({
                title: 'Dashboard',
                url: `/app/${projectId}/dashboard/${isDashboard.params.dashboardid}`,
                isActive: true
            })
        }

        if (isEvents) {
            items.push({title: 'Events', url: `/app/${projectId}/events`, isActive: true})
        }

        if  (isData) {
            items.push({title: 'Data', url: `/app/${projectId}/data`, isActive: true})
        }

        if (isSettings) {
            items.push({title: 'Settings', url: `/app/${projectId}/settings`, isActive: true})
        }

        return items
    }, [isAnalytics, isInsights, isEvents, projectId, isHome, isData, isInsight, isDashboard, isDashboards, isSettings])

    const projectUrl = `/app/${projectId}`

    return ({
        breadcrumbs,
        navMain: [
            {
                title: "Home",
                url: `/app/${projectId}`,
                icon: Home,
                isActive: !!isHome,
                items: [],
            },
            {
                title: "Dashboards",
                url: `${projectUrl}/dashboards`,
                isActive: !!isDashboards || !!isDashboard,
                icon: LayoutDashboard,
                items: [],
            },
            {
                title: "Insights",
                url: `${projectUrl}/insights`,
                isActive: !!isInsights || !!isInsight,
                icon: ChartLine,
                items: [],
            },
            {
                title: "Events",
                url: `${projectUrl}/events`,
                isActive: !!isEvents,
                icon: ListTree,
                items: [],
            },
            {
                title: "Data Management",
                url: `${projectUrl}/data`,
                icon: Database,
                isActive: !!isData,
                items: [
                    // {
                    //     title: "Overview & Statistics",
                    //     url: `${projectUrl}/data`,
                    //     isActive: !!isData,
                    // },
                    // {
                    //     title: "Real Time",
                    //     url: `${projectUrl}/data/realtime`,
                    //     isActive: !!isRealTimeEvents,
                    // },
                    // {
                    //     title: "Schema",
                    //     url: `${projectUrl}/data/schema`,
                    //     isActive: !!isSchema,
                    // },
                ],
            },
            {
                title: "Settings",
                url: `${projectUrl}/settings`,
                icon: Settings2,
                isActive: !!isSettings,
                items: [],
            },
            {
                title: "Query Tester",
                url: `${projectUrl}/queries`,
                icon: Filter,
                isActive: !!isQueryTester,
                items: [],
            },
        ],
    }) satisfies SidebarData
}

export interface SidebarData {
    navMain: {
        title: string
        url: string
        icon: LucideIcon
        isActive?: boolean
        items: {
            title: string
            url: string
            isActive?: boolean
        }[]
    }[]
    breadcrumbs: BreadcrumbItem[]
}

interface BreadcrumbItem {
    title: string
    url: string
    isActive?: boolean
}
