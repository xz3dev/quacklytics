import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {AppRouter} from "@/routes/routes.tsx";
import {BrowserRouter} from "react-router";
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <AppRouter/>
            </BrowserRouter>
        </QueryClientProvider>
    </StrictMode>,
)
