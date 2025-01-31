import {Route, Routes} from "react-router";
import {Landing} from "@app/landing/landing.tsx";
import {AppFrame} from "@app/appframe.tsx";
import LoginPage from "@app/login/page.tsx";
import {InsightsList} from "@app/insights/insight-list.tsx";
import {InsightView} from "@app/insights/insight-view.tsx";
import {EventsViewer} from "@app/events/events-viewer.tsx";
import {Home} from "@/app/home/home";
import {DashboardList} from "@app/dashboards/dashboard-list.tsx";
import {DashboardView} from "@app/dashboards/dashboard-view.tsx";
import {useDashboardId} from "@/hooks/use-dashboard-id.tsx";
import {useInsightId} from "@/hooks/use-insight-id.tsx";
import { SchemaView } from "@/app/schema/schema-view";
import {RealtimeEventsList} from "@app/realtime/realtime-events-list.tsx";
import {ProjectsList} from "@app/projects/projects-list.tsx";


export function AppRouter() {
    return (
        <Routes>
            <Route index element={<Landing></Landing>}></Route>

            {/*Auth*/}
            <Route path="login" element={<LoginPage></LoginPage>}></Route>

            <Route path="projects" element={<ProjectsList></ProjectsList>}></Route>
            {/*App*/}
            <Route path="app/:projectid" element={<AppFrame></AppFrame>}>
                <Route path="" element={<Home></Home>}></Route>
                <Route path="dashboards" element={<DashboardList></DashboardList>}></Route>
                <Route path="dashboards/:dashboardid" element={<DashboardRoute></DashboardRoute>}></Route>
                <Route path="insights" element={<InsightsList></InsightsList>}></Route>
                <Route path="insights/:insightid" element={<InsightRoute></InsightRoute>}></Route>
                <Route path="events" element={<EventsViewer></EventsViewer>}></Route>
                <Route path="data" element={<div>Data</div>}></Route>
                <Route path="data/realtime" element={<RealtimeEventsList></RealtimeEventsList>}></Route>
                <Route path="data/schema" element={<SchemaView></SchemaView>}></Route>
                <Route path="settings" element={<div>Settings</div>}></Route>
            </Route>
        </Routes>
    )
}

function DashboardRoute() {
    const dashboardId = useDashboardId()
    return (
        <DashboardView dashboardId={dashboardId}/>
    )
}
function InsightRoute() {
    const insightId = useInsightId()
    return (
        <InsightView insightId={insightId}/>
    )
}
