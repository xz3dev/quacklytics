import { useProjectId } from "./use-project-id";
import {
  ChartLine,
  Database,
  Home,
  LayoutDashboard,
  ListTree,
  LucideIcon,
  Cable,
  Filter,
} from "lucide-react";
import { useMatch } from "@/lib/navigation";

export function useSidebarData(): SidebarData {
  const projectId = useProjectId();
  const isHome = useMatch("/app/:projectid");
  const isInsights = useMatch("/app/:projectid/insights");
  const isInsight = useMatch("/app/:projectid/insights/:insightid");
  const isDashboards = useMatch("/app/:projectid/dashboards");
  const isDashboard = useMatch("/app/:projectid/dashboards/:dashboardid");
  const isEvents = useMatch("/app/:projectid/events");
  const isData = useMatch("/app/:projectid/data");
  // const isRealTimeEvents = useMatch('/app/:projectid/data/realtime')
  const isIngestion = useMatch("/app/:projectid/ingestion");
  const isQueryTester = useMatch("/app/:projectid/queries");
  const projectUrl = `/app/${projectId}`;

  return {
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
        title: "Ingestion",
        url: `${projectUrl}/ingestion`,
        icon: Cable,
        isActive: !!isIngestion,
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
  } satisfies SidebarData;
}

export interface SidebarData {
  navMain: {
    title: string;
    url: string;
    icon: LucideIcon;
    isActive?: boolean;
    items: {
      title: string;
      url: string;
      isActive?: boolean;
    }[];
  }[];
}
