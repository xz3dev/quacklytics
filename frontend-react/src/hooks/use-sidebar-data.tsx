import {useProjectId} from "./use-project-id";
import {ChartLine, HardDriveDownload, Home, LayoutDashboard, List, LucideIcon, Settings2} from "lucide-react";
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
    const isAnalytics = !!isHome || !!isEvents || !!isInsights || !!isInsight || !!isDashboards || !!isDashboard

    const breadcrumbs = useMemo(() => {
        const items: BreadcrumbItem[] = [
        ]

        if (isAnalytics) {
            items.push({ title: 'Analytics', url: `/app/${projectId}` })
        }

        if (isInsights || isInsight) {
            items.push({ title: 'Insights', url: `/app/${projectId}/insights`, isActive: !isInsight })
        }

        if(isInsight) {
            items.push({ title: 'Insight', url: `/app/${projectId}/insights/${isInsight.params.insightid}`, isActive: true })
        }

        if (isDashboard || isDashboards) {
            items.push({ title: 'Dashboards', url: `/app/${projectId}/dashboards`, isActive: !isInsight })
        }

        if(isDashboard) {
            items.push({ title: 'Dashboard', url: `/app/${projectId}/dashboard/${isDashboard.params.dashboardid}`, isActive: true })
        }

        if (isEvents) {
            items.push({ title: 'Events', url: `/app/${projectId}/events`, isActive: true })
        }

        return items
    }, [isAnalytics, isInsights, isEvents, projectId])

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
                icon: List,
                items: [],
            },
            {
                title: "Data Management",
                url: `${projectUrl}/data`,
                icon: HardDriveDownload,
                isActive: !!isData,
                items: [
                    {
                        title: "Overview & Statistics",
                        url: `${projectUrl}/data`,
                        isActive: !!isData,
                    },
                    {
                        title: "Real Time",
                        url: `${projectUrl}/data/realtime`,
                    },
                    {
                        title: "Schema",
                        url: `${projectUrl}/data/schema`,
                    },
                ],
            },
            {
                title: "Settings",
                url: "#",
                icon: Settings2,
                items: [
                    {
                        title: "General",
                        url: "#",
                    },
                    {
                        title: "Data Ingestion",
                        url: "#",
                    },
                    {
                        title: "Project",
                        url: "#",
                    },
                ],
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
