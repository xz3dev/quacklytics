import * as React from "react"
import {
  BookOpen,
  ChartLine,
  Frame,
  GalleryVerticalEnd,
  HardDriveDownload,
  LucideIcon,
  Map,
  PieChart,
  Settings2,
} from "lucide-react"

import {NavMain} from "@/components/nav-main"
import {NavDashboards} from "@/components/nav-dashboards.tsx"
import {NavUser} from "@/components/nav-user"
import {TeamSwitcher} from "@/components/team-switcher"
import {Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail,} from "@/components/ui/sidebar"

interface SidebarData {
  user: {
    name: string
    email: string
    avatar: string
  }
  teams: {
    name: string
    logo: LucideIcon
    plan: string
  }[]
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

export const sidebarSampleData =  {
    user: {
      name: "shadcn",
      email: "m@example.com",
      avatar: "/avatars/shadcn.jpg",
    },
    teams: [
      {
        name: "Default",
        logo: GalleryVerticalEnd,
        plan: "Enterprise",
      },
    ],
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
            url: "#",
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
            title: "Overview",
            url: "#",
          },
          {
            title: "Schema",
            url: "#",
          },
          {
            title: "Settings",
            url: "#",
          },
        ],
      },
      {
        title: "Documentation",
        url: "#",
        icon: BookOpen,
        items: [
          {
            title: "Introduction",
            url: "#",
          },
          {
            title: "Get Started",
            url: "#",
          },
          {
            title: "Tutorials",
            url: "#",
          },
          {
            title: "Changelog",
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
            title: "Team",
            url: "#",
          },
          {
            title: "Billing",
            url: "#",
          },
          {
            title: "Limits",
            url: "#",
          },
        ],
      },
    ],
    projects: [
      {
        name: "Design Engineering",
        url: "#",
        icon: Frame,
      },
      {
        name: "Sales & Marketing",
        url: "#",
        icon: PieChart,
      },
      {
        name: "Travel",
        url: "#",
        icon: Map,
      },
    ],
} satisfies SidebarData


export function AppSidebar(data: SidebarData, { ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDashboards projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
