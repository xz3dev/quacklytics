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
      <main className="max-w-2xl mx-auto py-20 space-y-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        {projects.data?.map((p) => (
          <Link
            key={p.id}
            to="/app/$projectid"
            params={{ projectid: p.id }}
            className="block rounded-xl bg-card p-5 transition-colors hover:bg-muted"
          >
            {p.name}
          </Link>
        ))}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-3"
        >
          <form.Field name="name">
            {(field) => (
              <label>
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
