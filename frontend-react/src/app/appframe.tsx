import {Link, Outlet, useNavigate} from "react-router";
import {AppSidebar} from "@/components/app-sidebar.tsx";
import {SidebarInset, SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar.tsx";
import {Separator} from "@/components/ui/separator.tsx";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from "@/components/ui/breadcrumb.tsx";
import {RequireAuth} from "@app/login/requireAuth.tsx";
import {useAuthStore} from "@/services/auth.ts";
import {DuckDB} from "@app/duckdb/duckdb.tsx";
import {useSidebarData} from "@/hooks/use-sidebar-data.tsx";
import {useProjectId} from "@/hooks/use-project-id.tsx";
import {useProjects} from "@/services/projects.ts";

export function AppFrame() {
    const {user} = useAuthStore()
    const sidebarData = useSidebarData()
    const projectId = useProjectId()
    const projects = useProjects()
    const navigate = useNavigate()

    if(projects.data && !projects.data.some(p => p.id === projectId)) {
        // project id does not exist, forward to project picker.
        navigate("/projects")
    }

    return (
        <RequireAuth>
            <SidebarProvider>
                <AppSidebar
                    user={{
                        name: user?.email ?? "",
                        email: "",
                        avatar: ""
                    }}
                    navMain={[...sidebarData.navMain]}
                />
                <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                        <SidebarTrigger className="-ml-1"/>
                        <Separator orientation="vertical" className="mr-2 h-4"/>
                        <Breadcrumb>
                            <BreadcrumbList>
                                {sidebarData.breadcrumbs.map((item, index) => (
                                    <div
                                        key={item.url}
                                        className="flex items-center gap-2"
                                    >
                                        <BreadcrumbItem className="hidden md:block">
                                            {index === sidebarData.breadcrumbs.length - 1 ? (
                                                <BreadcrumbPage>{item.title}</BreadcrumbPage>
                                            ) : (
                                                <BreadcrumbLink
                                                    asChild={true}
                                                >
                                                    <Link to={item.url}>
                                                        {item.title}
                                                    </Link>
                                                </BreadcrumbLink>
                                            )}
                                        </BreadcrumbItem>
                                        {index < sidebarData.breadcrumbs.length - 1 && (
                                            <BreadcrumbSeparator />
                                        )}
                                    </div>
                                ))}
                            </BreadcrumbList>
                        </Breadcrumb>
                    </header>
                    <div className="flex flex-1 flex-col gap-4 p-4">
                        <DuckDB> <!-- TODO: move duckdb inside project and fix data loading -->
                            <Outlet/>
                        </DuckDB>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </RequireAuth>
    )
}
