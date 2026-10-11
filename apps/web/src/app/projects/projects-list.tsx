import { ChevronRight, FolderPlus, Plus } from "lucide-react";
import { Link } from "@/lib/navigation";
import { useProjects } from "@/services/projects";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectAvatar, ProjectsShell } from "./projects-shell";

export function ProjectsList() {
  return (
    <ProjectsShell>
      <ProjectsOverview />
    </ProjectsShell>
  );
}

function ProjectsOverview() {
  const projects = useProjects();
  const sorted = [...(projects.data ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Each project tracks one site or app.
            </p>
          )}
        </div>
        {sorted.length > 0 && (
          <Button asChild>
            <Link to="/projects/new">
              <Plus />
              New project
            </Link>
          </Button>
        )}
      </header>

      {projects.isPending ? (
        <div aria-label="Loading projects" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4"
            >
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/40 p-4 text-sm"
        >
          Unable to load projects. {projects.error.message}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void projects.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-16 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <FolderPlus className="size-5 text-muted-foreground" />
          </span>
          <h2 className="font-medium">No projects yet</h2>
          <p className="mb-6 mt-1 max-w-sm text-sm text-muted-foreground">
            Projects keep events, dashboards and API keys separate. Create one
            for each site or app you want to track.
          </p>
          <Button asChild>
            <Link to="/projects/new">
              <Plus />
              Create your first project
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sorted.map((project) => (
            <li
              key={project.id}
              className="group relative flex items-center gap-4 rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-foreground/25 has-[a:focus-visible]:border-foreground/25 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring"
            >
              <ProjectAvatar name={project.name} emoji={project.emoji} />
              <div className="min-w-0 flex-1">
                <Link
                  to="/app/$projectid"
                  params={{ projectid: project.id }}
                  className="block truncate font-medium after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none"
                >
                  {project.name}
                </Link>
              </div>
              <ChevronRight
                aria-hidden="true"
                className="pointer-events-none size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
