import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {AppRouter} from "@/routes/routes.tsx";
import {BrowserRouter} from "react-router";
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ReactQueryDevtools} from "@tanstack/react-query-devtools";
import {ThemeProvider} from "@/components/theme/theme-provider.tsx";
import {createIDBPersister} from "@lib/indexed-db-persister.ts";
import {persistQueryClient} from "@tanstack/react-query-persist-client";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // gcTime: 1000 * 60 * 60 * 24 * 7, // 24 hours
        },
    },
})

const persister = createIDBPersister('analytics')

persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 24, // 24 hours
    dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
            // Example: Only persist queries where the first part of the query key is 'file'
            const [key] = query.queryKey;
            return key === 'file';
        },
    },
});

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
