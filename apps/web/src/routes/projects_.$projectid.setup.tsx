import { createFileRoute } from "@tanstack/react-router";
import { ProjectSetup } from "@/app/projects/setup/project-setup";
export const Route = createFileRoute("/projects_/$projectid/setup")({
  ssr: false,
  component: ProjectSetup,
});
