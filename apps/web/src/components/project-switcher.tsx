import { RenameProjectDialog } from "./rename-project-dialog";
import * as React from "react";
import { ChevronsUpDown, Pencil, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateProject, useProjects } from "@/services/projects";
import { useProjectSwitch } from "@/hooks/use-project-switch.tsx";
import { Project } from "@/model/project.ts";
import { useProjectId } from "@/hooks/use-project-id.tsx";

export function ProjectSwitcher() {
  const { isMobile } = useSidebar();
  const projectSwitch = useProjectSwitch();

  const { data: projects = [] } = useProjects();
  const activeProjectId = useProjectId();
  const createProject = useCreateProject();

  const activeProject = projects.find(
    (project) => project.id === activeProjectId,
  );
  const [editingProject, setEditingProject] = React.useState<Project | null>(
    null,
  );
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [newProjectName, setNewProjectName] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState("");

  const handleCreateProject = async () => {
    const trimmedName = newProjectName.trim();
    const namePattern = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]*[a-zA-Z0-9])?$/;

    // Clear any previous error message
    setErrorMessage("");

    if (!trimmedName) {
      setErrorMessage("Project name cannot be empty.");
      return;
    }

    if (!namePattern.test(trimmedName)) {
      setErrorMessage(
        "Invalid project name. Only letters, numbers, underscores, and hyphens are allowed. Hyphens and underscores cannot be at the start or end of the name.",
      );
      return;
    }

    try {
      await createProject.mutateAsync(trimmedName);
      setNewProjectName("");
      setIsCreateOpen(false);
      projectSwitch(trimmedName);
    } catch (error) {
      console.error("Failed to create project:", error);
      setErrorMessage("Failed to create project. Please try again later.");
    }
  };

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
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                {activeProject.name?.[0]?.toUpperCase()}
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
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
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
                    {project.name?.[0]?.toUpperCase()}
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
                    className="justify-center p-2"
                  >
                    <Pencil className="size-4" />
                  </button>
                </DropdownMenuItem>
              </div>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 p-2"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus size={16} />
              Create new project
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

      {/* Project creation dialog */}
      {isCreateOpen && (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
            </DialogHeader>
            {errorMessage && (
              <div
                className="mb-2 rounded bg-red-100 p-2 text-red-800"
                role="alert"
              >
                {errorMessage}
              </div>
            )}
            <div className="mt-4">
              <Input
                placeholder="Enter project name"
                value={newProjectName}
                onChange={(e) => {
                  setNewProjectName(e.target.value);
                  setErrorMessage(""); // clear error on change
                }}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateProject}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </SidebarMenu>
  );
}
