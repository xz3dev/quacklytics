import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {AppRouter} from "@/routes/routes.tsx";
import {BrowserRouter} from "react-router";


createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <AppRouter/>
        </BrowserRouter>
    </StrictMode>,
)
