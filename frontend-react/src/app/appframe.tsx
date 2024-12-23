import {Outlet} from "react-router";
import {AppSidebar, staticSidebarData} from "@/components/app-sidebar.tsx";
import {SidebarInset, SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar.tsx";
import {Separator} from "@/components/ui/separator.tsx";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList, BreadcrumbPage,
    BreadcrumbSeparator
} from "@/components/ui/breadcrumb.tsx";
import {RequireAuth} from "@app/login/requireAuth.tsx";
import {useAuthStore} from "@/services/auth.ts";

export function AppFrame() {
    const {user} = useAuthStore()
    return (
        <RequireAuth>
            <SidebarProvider>
                <AppSidebar
                    user={{
                        name: user?.email ?? "",
                        email: "",
                        avatar: ""
                    }}
                    teams={[...staticSidebarData.teams]}
                    navMain={[...staticSidebarData.navMain]}
                    projects={[...staticSidebarData.projects]}
                />
                <SidebarInset>
                    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
                        <SidebarTrigger className="-ml-1"/>
                        <Separator orientation="vertical" className="mr-2 h-4"/>
                        <Breadcrumb>
                            <BreadcrumbList>
                                <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink href="#">
                                        Building Your Application
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block"/>
                                <BreadcrumbItem>
                                    <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </header>
                    <div className="flex flex-1 flex-col gap-4 p-4">
                        <Outlet/>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </RequireAuth>
    )
}
