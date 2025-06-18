import {Route, Routes} from "react-router";
import {Landing} from "@app/landing/landing.tsx";
import {AppFrame} from "@app/appframe.tsx";
import LoginPage from "@app/login/page.tsx";
import {InsightsList} from "@app/insights/insight-list.tsx";
import {InsightView} from "@app/insights/insight-view.tsx";
import {Home} from "@/app/home/home";
import {DashboardList} from "@app/dashboards/dashboard-list.tsx";
import {DashboardView} from "@app/dashboards/dashboard-view.tsx";
import {useDashboardId} from "@/hooks/use-dashboard-id.tsx";
import {useInsightId} from "@/hooks/use-insight-id.tsx";
import {SchemaView} from "@/app/schema/schema-view";
import {ProjectsList} from "@app/projects/projects-list.tsx";
import RegisterPage from "@app/register/page.tsx";
import {ErrorBoundary} from "@/errors/global-error-handler.tsx";
import Settings from "@/settings/settings.tsx";
import {EventsList} from "@app/events/events-list.tsx";
import {QueryTester} from "@app/queries/query-tester.tsx";


export function AppRouter() {
    return (
        <ErrorBoundary>
            <Routes>
                <Route index element={<Landing></Landing>}></Route>

                {/*Auth*/}
                <Route path="login" element={<LoginPage></LoginPage>}></Route>
                <Route path="register" element={<RegisterPage></RegisterPage>}></Route>

                <Route path="projects" element={<ProjectsList></ProjectsList>}></Route>
                {/*App*/}
                <Route path="app/:projectid" element={<AppFrame></AppFrame>}>
                    <Route path="" element={<Home></Home>}></Route>
                    <Route path="dashboards" element={<DashboardList></DashboardList>}></Route>
                    <Route path="dashboards/:dashboardid" element={<DashboardRoute></DashboardRoute>}></Route>
                    <Route path="insights" element={<InsightsList></InsightsList>}></Route>
                    <Route path="insights/:insightid" element={<InsightRoute></InsightRoute>}></Route>
                    <Route path="events" element={<EventsList></EventsList>}></Route>
                    <Route path="data" element={<SchemaView></SchemaView>}></Route>
                    {/*<Route path="data/realtime" element={<RealtimeEventsList></RealtimeEventsList>}></Route>*/}
                    {/*<Route path="data/schema" element={<SchemaView></SchemaView>}></Route>*/}
                    <Route path="settings" element={<Settings></Settings>}></Route>


                    <Route path="queries" element={<QueryTester />}></Route>
                </Route>


                <Route path="*" element={<div className='m-auto text-center h-screen'>404 - Page Not Found</div>}></Route>
            </Routes>
        </ErrorBoundary>
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
