import {useQuery, useMutation, useQueryClient, type UseQueryOptions} from '@tanstack/react-query'
import {http} from '@/lib/fetch'
import {Insight} from '@/model/insight'

export const INSIGHTS_KEY = (project: string) => ['insights', project] as const
export const INSIGHT_KEY = (project: string, id: number) =>
    [...INSIGHTS_KEY(project), id] as const

const insightsApi = {
    getInsights: async (project: string): Promise<Insight[]> => {
        const response = await http.get<Insight[]>(`${project}/insights`)
        return response ?? []
    },

    createInsight: async (params: { project: string, name: string }): Promise<Insight> => {
        return http.post<Insight>(`${params.project}/insights`, {
            type: 'Trend',
            name: params.name,
            description: '',
            series: [],
        })
    },

    deleteInsight: async (params: { project: string, insightId: number }): Promise<void> => {
        await http.del(`${params.project}/insights/${params.insightId}`)
    },

    updateInsight: async (params: { project: string, insight: Insight }): Promise<Insight> => {
        return http.put<Insight>(`${params.project}/insights/${params.insight.id}`, params.insight)
    },

    getInsight: async (params: { project: string | number, id: number }): Promise<Insight> => {
        return await http.get<Insight>(`${params.project}/insights/${params.id}`)
    },
}

// Query hook with options
export function useInsights(
    project: string,
    options?: Partial<UseQueryOptions<Insight[], Error>>
) {
    return useQuery<Insight[], Error>({
        queryKey: INSIGHTS_KEY(project),
        queryFn: () => insightsApi.getInsights(project),
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
        ...options,
    })
}

// Mutation hooks
export function useCreateInsight(project: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (name: string) => insightsApi.createInsight({project, name}),
        onSuccess: (newInsight) => {
            queryClient.setQueryData<Insight[]>(
                INSIGHTS_KEY(project),
                (old = []) => [...old, newInsight]
            )
        },
    })
}

export function useDeleteInsight(project: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (insightId: number) => insightsApi.deleteInsight({project, insightId}),
        onSuccess: (_, insightId) => {
            queryClient.setQueryData<Insight[]>(
                INSIGHTS_KEY(project),
                (old = []) => old.filter(insight => insight.id !== insightId)
            )
        },
    })
}

export function useUpdateInsight(project: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (insight: Insight) => insightsApi.updateInsight({project, insight}),
        onSuccess: (updatedInsight) => {
            queryClient.setQueryData<Insight[]>(
                INSIGHTS_KEY(project),
                (old = []) => old.map(insight =>
                    insight.id === updatedInsight.id ? updatedInsight : insight
                )
            )
        },
    })
}

export function useInsight(
    project: string,
    id: number,
    options?: Partial<UseQueryOptions<Insight, Error>>
) {
    const queryClient = useQueryClient()

    return useQuery<Insight, Error>({
        queryKey: INSIGHT_KEY(project, id),
        queryFn: () => insightsApi.getInsight({project, id}),
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
        initialData: () => {
            const insights = queryClient.getQueryData<Insight[]>(INSIGHTS_KEY(project))
            return insights?.find(insight => insight.id === id)
        },
        ...options,
    })
}
