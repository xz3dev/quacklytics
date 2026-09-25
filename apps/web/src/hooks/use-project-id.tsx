import { useParams } from "@/lib/navigation";
import { useProjects } from "@/services/projects.ts";

export function useProjectId() {
  const { projectid } = useParams();
  if (!projectid) throw new Error("Project ID not found in URL");
  return projectid;
}

export function useProject() {
  const projectId = useProjectId();
  const projects = useProjects();
  return projects.data?.find((project) => project.id === projectId);
}
