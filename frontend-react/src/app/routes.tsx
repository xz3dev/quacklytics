import {Route, Routes} from "react-router";
import {Landing} from "@app/routes/landing.tsx";
import {Login} from "@app/routes/auth/login.tsx";
import {Register} from "@app/routes/auth/register.tsx";
import {Home} from "@app/routes/app/home.tsx";


export function AppRouter() {
    return (
        <Routes>
            {/*App*/}
            <Route path="app" element={<Home></Home>}>
                <Route path={'test'} element={<h1>test</h1>}></Route>
            </Route>
        </Routes>
    )
}

export function BaseRouter() {
    return (
        <Routes>
            <Route index element={<Landing></Landing>}></Route>

            {/*Auth*/}
            <Route path="login" element={<Login></Login>}></Route>
            <Route path="register" element={<Register></Register>}></Route>

        </Routes>
    )
}
