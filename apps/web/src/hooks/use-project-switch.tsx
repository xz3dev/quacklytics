import { useLocation, useNavigate } from "@/lib/navigation";
import { useProjectId } from "@/hooks/use-project-id.tsx";

export function useProjectSwitch() {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = useProjectId();

  const switchProject = (newProjectId: string) => {
    if (!projectId) {
      navigate(`/app/${newProjectId}`);
      return;
    }

    const newPath = location.pathname.replace(
      `/app/${projectId}`,
      `/app/${newProjectId}`,
    );

    navigate(`${newPath}${location.searchStr}`);
  };

  return switchProject;
}
