import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '@/lib/fetch'
import { Project } from "@/model/project"

const PROJECTS_KEY = 'projects' as const

// API functions
const projectsApi = {
    getProjects: async (): Promise<Project[]> => {
        const response = await http.get<Project[]>('/projects')
        return response ?? []
    },

    createProject: async (name: string): Promise<Project> => {
        return http.post<Project>('/projects', { name })
    }
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
            console.log('updating, ', [...old, newProject])
                    return [...old, newProject];
                }
            )
        }
    })
}
