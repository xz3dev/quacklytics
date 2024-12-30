import {useProjectId} from "./use-project-id";
import {ChartLine, HardDriveDownload, LucideIcon, Settings2} from "lucide-react";

export function useSidebarData(): SidebarData {
    const projectId = useProjectId()

    return ({
        navMain: [
            {
                title: "Analytics",
                url: "#",
                icon: ChartLine,
                isActive: true,
                items: [
                    {
                        title: "Dashboards",
                        url: "#",
                    },
                    {
                        title: "Insights",
                        url: `/app/${projectId}/insights`,
                    },
                    {
                        title: "Events",
                        url: "#",
                    },
                ],
            },
            {
                title: "Data Ingestion",
                url: "#ts",
                icon: HardDriveDownload,
                items: [
                    {
                        title: "Overview & Statistics",
                        url: "#",
                    },
                    {
                        title: "Real Time",
                        url: "#",
                    },
                    {
                        title: "Schema",
                        url: "#",
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
}
