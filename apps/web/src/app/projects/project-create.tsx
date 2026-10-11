import { useForm } from "@tanstack/react-form";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "@/lib/navigation";
import { useCreateProject } from "@/services/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectEmojiPopover } from "@/components/project-emoji-popover";
import { ProjectAvatar, ProjectsShell } from "./projects-shell";

export function ProjectCreate() {
  return (
    <ProjectsShell>
      <CreateProjectForm />
    </ProjectsShell>
  );
}

function CreateProjectForm() {
  const create = useCreateProject();
  const navigate = useNavigate();
  const form = useForm({
    defaultValues: { name: "", emoji: "" },
    onSubmit: async ({ value }) => {
      const project = await create.mutateAsync({
        name: value.name.trim(),
        emoji: value.emoji,
      });
      await navigate(`/projects/${project.id}/setup`);
    },
  });

  return (
    <div className="mx-auto max-w-xl">
      <Link
        to="/projects"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All projects
      </Link>
      <header className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create a project
        </h1>
        <p className="text-sm text-muted-foreground">
          A project has its own events, dashboards, insights and API keys. Use
          one per site or app you want to track.
        </p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!create.isPending) void form.handleSubmit();
        }}
        className="rounded-xl border border-border/50 bg-card"
      >
        <div className="space-y-6 p-6">
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  autoFocus
                  required
                  maxLength={200}
                  placeholder="e.g. Marketing site"
                  value={field.state.value}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    create.reset();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  You can rename it at any time.
                </p>
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.values}>
            {(values) => (
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="flex items-center gap-3">
                  <ProjectEmojiPopover
                    onSelect={(emoji) => form.setFieldValue("emoji", emoji)}
                    anchor={
                      <ProjectAvatar
                        name={values.name}
                        emoji={values.emoji}
                        className="size-12 text-xl"
                      />
                    }
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label="Choose project emoji"
                      >
                        {values.emoji ? "Change emoji" : "Choose emoji"}
                      </Button>
                    }
                  />
                  {values.emoji && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => form.setFieldValue("emoji", "")}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            )}
          </form.Subscribe>

          {create.error && (
            <p role="alert" className="text-sm text-destructive">
              {create.error.message}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border/50 px-6 py-4">
          <Button asChild variant="ghost">
            <Link to="/projects">Cancel</Link>
          </Button>
          <form.Subscribe selector={(state) => state.values.name.trim()}>
            {(name) => (
              <Button type="submit" disabled={!name || create.isPending}>
                {create.isPending ? "Creating project…" : "Create project"}
              </Button>
            )}
          </form.Subscribe>
        </footer>
      </form>
    </div>
  );
}
