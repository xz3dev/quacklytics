// src/services/insights.ts
import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { http } from '@/lib/fetch'
import { Insight } from '@/model/insight'

// Query key
export const INSIGHTS_KEY = (project: string | number) => ['insights', project] as const

// API functions
const insightsApi = {
    getInsights: async (project: string | number): Promise<Insight[]> => {
        const response = await http.get<Insight[]>(`${project}/insights`)
        return response ?? []
    },

    createInsight: async (params: { project: string | number, name: string }): Promise<Insight> => {
        return http.post<Insight>(`${params.project}/insights`, {
            type: 'Trend',
            name: params.name,
            description: '',
            series: [],
        })
    },

    deleteInsight: async (params: { project: string | number, insightId: number }): Promise<void> => {
        await http.del(`${params.project}/insights/${params.insightId}`)
    },

    updateInsight: async (params: { project: string | number, insight: Insight }): Promise<Insight> => {
        return http.put<Insight>(`${params.project}/insights/${params.insight.id}`, params.insight)
    },
}

// Query hook with options
export function useInsights(
    project: string | number,
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
export function useCreateInsight(project: string | number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (name: string) => insightsApi.createInsight({ project, name }),
        onSuccess: (newInsight) => {
            queryClient.setQueryData<Insight[]>(
                INSIGHTS_KEY(project),
                (old = []) => [...old, newInsight]
            )
        },
    })
}

export function useDeleteInsight(project: string | number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (insightId: number) => insightsApi.deleteInsight({ project, insightId }),
        onSuccess: (_, insightId) => {
            queryClient.setQueryData<Insight[]>(
                INSIGHTS_KEY(project),
                (old = []) => old.filter(insight => insight.id !== insightId)
            )
        },
    })
}

export function useUpdateInsight(project: string | number) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (insight: Insight) => insightsApi.updateInsight({ project, insight }),
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
