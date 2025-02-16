import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {http} from '@/lib/fetch'
import {Project} from "@/model/project"

const PROJECTS_KEY = 'projects' as const

const projectsApi = {
    getProjects: async (): Promise<Project[]> => {
        const response = await http.get<Project[]>('/projects')
        return response ?? []
    },

    createProject: async (name: string): Promise<Project> => {
        return http.post<Project>('/projects', {name})
    },

    updateSetting: async (
        projectId: string,
        setting: { key: string; value: string }
    ): Promise<void> => {
        await http.post(`/${projectId}/settings`, [setting]);
    },

}

export function useProjects(key: string = PROJECTS_KEY) {
    return useQuery({
        queryKey: [key],
        queryFn: projectsApi.getProjects,
    })
}

export function useCreateProject() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (name: string) => projectsApi.createProject(name),
        onSuccess: (newProject) => {
            queryClient.setQueryData<Project[]>(
                [PROJECTS_KEY],
                (old = []) => {
                    return [...old, newProject];
                }
            )
        }
    })
}

export function useUpdateAutoLoad() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (params: { projectId: string, value: number }) => {
            return projectsApi.updateSetting(params.projectId, {key: 'autoload', value: params.value.toString()});
        },
        onSuccess: (_, variables) => {
            queryClient.setQueryData<Project[]>(
                [PROJECTS_KEY],
                (old = []) => {
                    return old.map(p => {
                        if(p.id === variables.projectId) {
                            return {
                                ...p,
                                autoload: variables.value,
                            }
                        }
                        return p
                    })
                }
            )
        },
    })
}
export function useUpdateProjectName() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (params: { projectId: string, value: string }) => {
            return projectsApi.updateSetting(params.projectId, {key: 'name', value: params.value});
        },
        onSuccess: (_, variables) => {
            queryClient.setQueryData<Project[]>(
                [PROJECTS_KEY],
                (old = []) => {
                    return old.map(p => {
                        if(p.id === variables.projectId) {
                            return {
                                ...p,
                                name: variables.value,
                            }
                        }
                        return p
                    })
                }
            )
        },
    })
}
