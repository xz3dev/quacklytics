import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {AppRouter} from "@/routes/routes.tsx";
import {BrowserRouter} from "react-router";
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ReactQueryDevtools} from "@tanstack/react-query-devtools";
import {ThemeProvider} from "@/components/theme/theme-provider.tsx";

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="ui-theme">
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <AppRouter/>
                </BrowserRouter>
                <ReactQueryDevtools initialIsOpen={false} />
            </QueryClientProvider>
        </ThemeProvider>
    </StrictMode>,
)
