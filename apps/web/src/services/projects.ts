import { project as projectSchema } from "@quacklytics/contracts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "@/client/api/http";
import { Project } from "@/model/project";

const PROJECTS_KEY = "projects" as const;

const projectsApi = {
  getProjects: async (): Promise<Project[]> => {
    const response = await http.get("/projects", projectSchema.array());
    return response ?? [];
  },

  createProject: async (input: {
    name: string;
    emoji: string;
  }): Promise<Project> => {
    return http.post("/projects", input, projectSchema);
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
    mutationFn: (input: { name: string; emoji: string }) =>
      projectsApi.createProject(input),
    onSuccess: (newProject) => {
      queryClient.setQueryData<Project[]>(
        [PROJECTS_KEY],
        (old) => old && [...old, newProject],
      );
    },
  });
}

export function useUpdateProjectDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { projectId: string; name: string; emoji: string }) =>
      http.post(
        `/${params.projectId}/settings`,
        [
          { key: "name", value: params.name },
          { key: "emoji", value: params.emoji },
        ],
        projectSchema.array(),
      ),
    onSuccess: (projects) => {
      queryClient.setQueryData<Project[]>([PROJECTS_KEY], projects);
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
