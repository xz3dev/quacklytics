import { PageHeader, PageTitle } from "@/components/page-header";
import { Link, useNavigate } from "@/lib/navigation";
import { useProjects, useCreateProject } from "@/services/projects";
import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequireAuth } from "@/app/login/requireAuth";
export function ProjectsList() {
  const projects = useProjects();
  const create = useCreateProject();
  const navigate = useNavigate();
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ value }) => {
      const project = await create.mutateAsync(value.name);
      await navigate(`/app/${project.id}`);
    },
  });
  return (
    <RequireAuth>
      <main className="max-w-2xl mx-auto p-4 md:p-6">
        <PageHeader>
          <PageTitle>Projects</PageTitle>
        </PageHeader>
        {projects.data?.map((p) => (
          <Link
            key={p.id}
            to="/app/$projectid"
            params={{ projectid: p.id }}
            className="mb-4 block break-words rounded-xl border border-border/50 bg-card p-4 transition-colors hover:border-foreground/25"
          >
            {p.name}
          </Link>
        ))}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
          className="mt-8 space-y-4 rounded-xl border border-border/50 bg-card p-4"
        >
          <form.Field name="name">
            {(field) => (
              <label className="grid gap-2 text-sm font-medium">
                Project name
                <Input
                  required
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </label>
            )}
          </form.Field>
          <Button type="submit" disabled={create.isPending}>
            Create project
          </Button>
          {create.error && <p role="alert">{create.error.message}</p>}
        </form>
      </main>
    </RequireAuth>
  );
}
