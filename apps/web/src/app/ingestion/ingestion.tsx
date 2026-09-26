import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader, PageTitle } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjectId } from "@/hooks/use-project-id";
import { useProjects, useUpdateProjectCorsOrigins } from "@/services/projects";
import { Spinner } from "@/components/spinner";
import { ApikeyManagement } from "@app/apikeys/apikey-management";
import { Project } from "@/model/project";

function AllowedOrigins({ project }: { project: Project }) {
  const updater = useUpdateProjectCorsOrigins();
  const [newOrigin, setNewOrigin] = useState("");
  const [error, setError] = useState("");

  const save = async (origins: string[]) => {
    setError("");
    try {
      await updater.mutateAsync({
        projectId: project.id,
        value: JSON.stringify(origins),
      });
      return true;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update allowed origins. Please try again.",
      );
      return false;
    }
  };

  const addOrigin = async () => {
    if (updater.isPending) return;
    const origin = newOrigin.trim();
    try {
      if (origin !== "*") {
        const url = new URL(origin);
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.origin !== origin
        )
          throw new Error("Invalid origin");
      }
    } catch {
      setError(
        "Enter an origin with a scheme and host, such as https://app.example.com, without a path or trailing slash.",
      );
      return;
    }
    if (project.corsOrigins.includes(origin)) {
      setError("This origin is already allowed.");
      return;
    }
    if (await save([...project.corsOrigins, origin])) setNewOrigin("");
  };

  return (
    <section
      aria-labelledby="allowed-origins-heading"
      className="space-y-4 rounded-xl border border-border/50 bg-card p-4"
    >
      <h2 id="allowed-origins-heading" className="text-xl font-semibold">
        Allowed origins
      </h2>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Allowed origins control which websites can send browser events to this
        project using CORS. Add each website’s origin (scheme, host, and
        optional port), or use * to allow all origins; changes save
        automatically.
      </p>
      {project.corsOrigins.length ? (
        <ul
          aria-label="Allowed origins"
          className="divide-y rounded-lg border border-border/50"
        >
          {project.corsOrigins.map((origin) => (
            <li key={origin} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 break-all font-mono text-sm">
                {origin}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${origin}`}
                disabled={updater.isPending}
                onClick={() =>
                  save(project.corsOrigins.filter((value) => value !== origin))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No allowed origins added.
        </p>
      )}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void addOrigin();
        }}
      >
        <Label htmlFor="new-origin">New origin</Label>
        <div className="flex gap-2">
          <Input
            id="new-origin"
            className="min-w-0 flex-1 font-mono text-sm"
            placeholder="https://app.example.com"
            value={newOrigin}
            disabled={updater.isPending}
            onChange={(event) => {
              setNewOrigin(event.target.value);
              setError("");
            }}
          />
          <Button
            type="submit"
            disabled={updater.isPending || !newOrigin.trim()}
          >
            <Plus className="mr-2 size-4" />
            Add
          </Button>
        </div>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

export default function Ingestion() {
  const projectId = useProjectId();
  const projects = useProjects();
  const project = projects.data?.find((project) => project.id === projectId);
  if (projects.isPending) return <Spinner />;
  if (projects.isError) return <div>Error: {projects.error.message}</div>;
  if (!project) return <div>Project not found</div>;

  return (
    <div className="min-w-0">
      <PageHeader>
        <PageTitle>Ingestion</PageTitle>
      </PageHeader>
      <div className="max-w-4xl space-y-4">
        <ApikeyManagement />
        <AllowedOrigins key={project.id} project={project} />
      </div>
    </div>
  );
}
