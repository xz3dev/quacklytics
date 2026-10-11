import { RenameProjectDialog } from "./rename-project-dialog";
import * as React from "react";
import { ChevronsUpDown, LayoutGrid, Pencil, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useProjects } from "@/services/projects";
import { Link } from "@/lib/navigation";
import { useProjectSwitch } from "@/hooks/use-project-switch.tsx";
import { Project } from "@/model/project.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";

export function ProjectSwitcher() {
  const { isMobile } = useSidebar();
  const projectSwitch = useProjectSwitch();

  const { data: projects = [] } = useProjects();
  const activeProjectId = useProjectId();

  const activeProject = projects.find(
    (project) => project.id === activeProjectId,
  );
  const [editingProject, setEditingProject] = React.useState<Project | null>(
    null,
  );
  const navigateToProject = async (project: Project) => {
    projectSwitch(project.id);
  };

  if (!activeProject || projects.length === 0) return <></>;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              aria-label="Select project"
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg border border-border/50 bg-muted text-lg font-semibold text-foreground">
                {activeProject.emoji || activeProject.name?.[0]?.toUpperCase()}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeProject.name}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-[--radix-dropdown-menu-trigger-width] min-w-56 overflow-y-auto overscroll-contain rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Projects
            </DropdownMenuLabel>
            {projects.map((project) => (
              <div key={project.id} className="flex items-center gap-1">
                <DropdownMenuItem
                  onClick={() => navigateToProject(project)}
                  className="min-w-0 flex-1 gap-2 p-2"
                >
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted">
                    {project.emoji || project.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="truncate">{project.name}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  onSelect={() => setEditingProject(project)}
                >
                  <button
                    type="button"
                    aria-label={`Rename ${project.name}`}
                    title="Rename project"
                    className="size-10 shrink-0 justify-center p-0"
                  >
                    <Pencil className="size-4" />
                  </button>
                </DropdownMenuItem>
              </div>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="flex items-center gap-2 p-2">
              <Link to="/projects">
                <LayoutGrid size={16} />
                All projects
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="flex items-center gap-2 p-2">
              <Link to="/projects/new">
                <Plus size={16} />
                Create new project
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      {editingProject && (
        <RenameProjectDialog
          project={editingProject}
          onClose={() => setEditingProject(null)}
        />
      )}
    </SidebarMenu>
  );
}
