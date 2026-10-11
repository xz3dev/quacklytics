import { createFileRoute } from "@tanstack/react-router";
import { ProjectCreate } from "@/app/projects/project-create";
export const Route = createFileRoute("/projects_/new")({
  ssr: false,
  component: ProjectCreate,
});
