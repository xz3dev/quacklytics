import * as React from "react"

import {NavMain} from "@/components/nav-main"
import {NavUser} from "@/components/nav-user"
import {ProjectSwitcher} from "@/components/project-switcher.tsx"
import {Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail,} from "@/components/ui/sidebar"
import {SidebarData} from "@/hooks/use-sidebar-data.tsx";


export function AppSidebar(
    data: Pick<SidebarData, 'navMain'> & {
        user: {
            name: string
            email: string
            avatar: string
        }
    },
    {...props}: React.ComponentProps<typeof Sidebar>,
) {
    return (
        <Sidebar collapsible="icon" {...props}>
            <SidebarHeader>
                <ProjectSwitcher/>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain}/>
                {/*<NavDashboards projects={data.projects} />*/}
            </SidebarContent>
            <SidebarFooter>
                <NavUser user={data.user}/>
            </SidebarFooter>
            <SidebarRail/>
        </Sidebar>
    )
}
