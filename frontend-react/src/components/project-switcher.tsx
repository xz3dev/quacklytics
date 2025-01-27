import * as React from "react"
import {ChevronsUpDown, Plus} from "lucide-react"
import {Dialog, DialogContent, DialogHeader, DialogTitle,} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,} from "@/components/ui/sidebar"
import {Input} from "@/components/ui/input"
import {Button} from "@/components/ui/button"
import {useCreateProject, useProjects} from "@/services/projects"
import {useProjectSwitch} from "@/hooks/use-project-switch.tsx";
import {Project} from "@/model/project.ts";

export function ProjectSwitcher() {
    const {isMobile} = useSidebar()
    const projectSwitch = useProjectSwitch()

    const {data: projects = []} = useProjects()
    const createProject = useCreateProject()

    const [activeProject, setActiveProject] = React.useState(projects?.[0])
    const [isCreateOpen, setIsCreateOpen] = React.useState(false)
    const [newProjectName, setNewProjectName] = React.useState("")

    // Update active project when projects load
    React.useEffect(() => {
        if (projects.length > 0 && !activeProject) {
            setActiveProject(projects[0])
        }
    }, [projects, activeProject])

    const handleCreateProject = async () => {
        if (newProjectName.trim()) {
            try {
                await createProject.mutateAsync(newProjectName)
                setNewProjectName("")
                setIsCreateOpen(false)
                projectSwitch(newProjectName)
            } catch (error) {
                console.error("Failed to create project:", error)
            }
        }
    }

    const navigateToProject = async (project: Project) => {
        setActiveProject(project)
        projectSwitch(project.id)
    }

    if (!activeProject || projects.length === 0) return <></>

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <div
                                className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                {activeProject.name?.[0]?.toUpperCase()}
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeProject.name}
                </span>
                            </div>
                            <ChevronsUpDown className="ml-auto"/>
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
                            <DropdownMenuItem
                                key={project.id}
                                onClick={() => navigateToProject(project)}
                                className="gap-2 p-2"
                            >
                                <div className="flex size-6 items-center justify-center rounded-sm border">
                                    {project.name?.[0]?.toUpperCase()}
                                </div>
                                {project.name}
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem
                            className="gap-2 p-2"
                            onClick={() => setIsCreateOpen(true)}
                        >
                            <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                                <Plus className="size-4"/>
                            </div>
                            <div className="font-medium text-muted-foreground">Add project</div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <Input
                            placeholder="Project name"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    void handleCreateProject()
                                }
                            }}
                        />
                        <Button
                            onClick={handleCreateProject}
                            disabled={createProject.isPending}
                        >
                            {createProject.isPending ? "Creating..." : "Create Project"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </SidebarMenu>
    )
}
