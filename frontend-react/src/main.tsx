import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import {AppRouter, BaseRouter} from "@app/routes.tsx";
import {BrowserRouter} from "react-router";


createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <BaseRouter/>
            <AppRouter/>
        </BrowserRouter>
    </StrictMode>,
)
