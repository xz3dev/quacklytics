import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {AppRouter, BaseRouter} from "@/routes/routes.tsx";
import {BrowserRouter} from "react-router";


createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <BaseRouter/>
            <AppRouter/>
        </BrowserRouter>
    </StrictMode>,
)
