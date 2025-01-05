import {Route, Routes} from "react-router";
import {Landing} from "@app/landing/landing.tsx";
import {AppFrame} from "@app/appframe.tsx";
import LoginPage from "@app/login/page.tsx";
import {InsightsList} from "@app/insights/insight-list.tsx";
import {InsightView} from "@app/insights/insight-view.tsx";
import {EventsViewer} from "@app/events/events-viewer.tsx";
import { Home } from "@/app/home/home";
import {DashboardList} from "@app/dashboards/dashboard-list.tsx";


export function AppRouter() {
    return (
        <Routes>
            <Route index element={<Landing></Landing>}></Route>

            {/*Auth*/}
            <Route path="login" element={<LoginPage></LoginPage>}></Route>

            {/*App*/}
            <Route path="app/:projectid" element={<AppFrame></AppFrame>}>
                <Route path="" element={<Home></Home>}></Route>
                <Route path="dashboards" element={<DashboardList></DashboardList>}></Route>
                <Route path="insights" element={<InsightsList></InsightsList>}></Route>
                <Route path="insights/:insightid" element={<InsightView></InsightView>}></Route>
                <Route path="events" element={<EventsViewer></EventsViewer>}></Route>
            </Route>
        </Routes>
    )
}
