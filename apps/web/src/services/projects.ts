import { project as projectSchema } from "@quacklytics/contracts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/lib/fetch";
import { Project } from "@/model/project";

const PROJECTS_KEY = "projects" as const;

const projectsApi = {
  getProjects: async (): Promise<Project[]> => {
    const response = await http.get("/projects", projectSchema.array());
    return response ?? [];
  },

  createProject: async (name: string): Promise<Project> => {
    return http.post("/projects", { name }, projectSchema);
  },

  updateSetting: async (
    projectId: string,
    setting: { key: string; value: string },
  ): Promise<Project[]> => {
    return await http.post(
      `/${projectId}/settings`,
      [setting],
      projectSchema.array(),
    );
  },
};

export function useProjects(key: string = PROJECTS_KEY) {
  return useQuery({
    queryKey: [key],
    queryFn: projectsApi.getProjects,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => projectsApi.createProject(name),
    onSuccess: (newProject) => {
      queryClient.setQueryData<Project[]>([PROJECTS_KEY], (old = []) => {
        console.log(newProject, old);
        return [...old, newProject];
      });
    },
  });
}

export function useUpdateProjectName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { projectId: string; value: string }) => {
      return projectsApi.updateSetting(params.projectId, {
        key: "name",
        value: params.value,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData<Project[]>([PROJECTS_KEY], (old = []) => {
        return old.map((p) => {
          if (p.id === variables.projectId) {
            return {
              ...p,
              name: variables.value,
            };
          }
          return p;
        });
      });
    },
  });
}

export function useUpdateProjectCorsOrigins() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { projectId: string; value: string }) => {
      return projectsApi.updateSetting(params.projectId, {
        key: "cors_origins",
        value: params.value,
      });
    },
    onSuccess: (projects) => {
      queryClient.setQueryData<Project[]>([PROJECTS_KEY], projects);
    },
  });
}
