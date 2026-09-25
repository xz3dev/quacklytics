import { createFileRoute } from "@tanstack/react-router";
import { ProjectsList } from "@/app/projects/projects-list";
export const Route = createFileRoute("/projects")({
  ssr: false,
  component: ProjectsList,
});
