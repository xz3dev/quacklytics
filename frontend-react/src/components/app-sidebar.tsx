import * as React from "react"
import {ChartLine, HardDriveDownload, LucideIcon, Settings2,} from "lucide-react"

import {NavMain} from "@/components/nav-main"
import {NavUser} from "@/components/nav-user"
import {ProjectSwitcher} from "@/components/project-switcher.tsx"
import {Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail,} from "@/components/ui/sidebar"

interface SidebarData {
  user: {
    name: string
    email: string
    avatar: string
  }
  navMain: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    items: {
      title: string
      url: string
    }[]
  }[]
  projects: {
    name: string
    url: string
    icon: LucideIcon
  }[]
}

export const staticSidebarData =  (projectId: string) => ({
    user: {
      name: "shadcn",
      email: "m@example.com",
      avatar: "/avatars/shadcn.jpg",
    },
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
    projects: [],
}) satisfies SidebarData


export function AppSidebar(data: SidebarData, { ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <ProjectSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/*<NavDashboards projects={data.projects} />*/}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
