import { Outlet, useNavigate } from "@/lib/navigation";
import { AppSidebar } from "@/components/app-sidebar.tsx";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar.tsx";
import { RequireAuth } from "@app/login/requireAuth.tsx";
import { useAuthStore } from "@/services/auth.ts";
import { DuckDB } from "@app/duckdb/duckdb.tsx";
import { useSidebarData } from "@/hooks/use-sidebar-data.tsx";
import { useProjectId } from "@/hooks/use-project-id.tsx";
import { useProjects } from "@/services/projects.ts";
import { DuckDbProvider } from "@app/duckdb/duckdb-provider.tsx";

export function AppFrame() {
  const { user } = useAuthStore();
  const sidebarData = useSidebarData();
  const projectId = useProjectId();
  const projects = useProjects();
  const navigate = useNavigate();

  if (projects.data && !projects.data.some((p) => p.id === projectId)) {
    // project id does not exist, forward to project picker.
    navigate("/projects");
  }

  return (
    <RequireAuth>
      <DuckDbProvider>
        <DuckDB>
          <SidebarProvider fixedCollapsed>
            <AppSidebar
              user={{
                name: user?.email ?? "",
                email: "",
                avatar: "",
              }}
              navMain={[...sidebarData.navMain]}
            />
            <SidebarInset>
              <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
                <Outlet />
              </div>
            </SidebarInset>
          </SidebarProvider>
        </DuckDB>
      </DuckDbProvider>
    </RequireAuth>
  );
}
