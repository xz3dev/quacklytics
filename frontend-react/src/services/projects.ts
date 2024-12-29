import {useQuery} from '@tanstack/react-query'
import {http} from '@/lib/fetch'
import {Project} from "@/model/project"

const getProjects = async (): Promise<Project[]> => {
    const response = await http.get<Project[]>('/projects')
    return response ?? []
}

export function useProjects(key: string = 'all') {
    return useQuery({
        queryKey: [key],
        queryFn: getProjects,
    })
}
