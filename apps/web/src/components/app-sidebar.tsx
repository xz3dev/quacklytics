import * as React from "react";
import { AnalyticsFreshness } from "@/app/duckdb/analytics-freshness";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { ProjectSwitcher } from "@/components/project-switcher.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { SidebarData } from "@/hooks/use-sidebar-data.tsx";

export function AppSidebar(
  data: Pick<SidebarData, "navMain"> & {
    user: {
      name: string;
      email: string;
      avatar: string;
    };
  },
) {
  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader className="gap-4">
        <ProjectSwitcher />
        <AnalyticsFreshness />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        {/*<NavDashboards projects={data.projects} />*/}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
