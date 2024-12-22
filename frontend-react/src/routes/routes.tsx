import {Route, Routes} from "react-router";
import {Landing} from "@app/landing/landing.tsx";
import {AppFrame} from "@app/appframe.tsx";
import LoginPage from "@app/login/page.tsx";


export function AppRouter() {
    return (
        <Routes>
            <Route index element={<Landing></Landing>}></Route>

            {/*Auth*/}
            <Route path="login" element={<LoginPage></LoginPage>}></Route>

            {/*App*/}
            <Route path="app" element={<AppFrame></AppFrame>}>
                <Route path={'test'} element={<h1>test</h1>}></Route>
            </Route>
        </Routes>
    )
}
