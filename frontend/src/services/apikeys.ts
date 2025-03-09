import {
    useQuery,
    useMutation,
    useQueryClient,
    type UseQueryOptions,
} from '@tanstack/react-query'
import { http } from '@/lib/fetch'

export interface ApiKey {
    id: number
    createdAt: number
    project: string
    key: string
}

// Query keys
export const API_KEYS_KEY = (projectId: string) => ['apiKeys', projectId] as const
export const API_KEY_KEY = (projectId: string, id: number): string[] =>
    [...API_KEYS_KEY(projectId), id.toString()] as const

// API key API functions
const apiKeysApi = {
    getApiKeys: async (projectId: string): Promise<ApiKey[]> => {
        const response = await http.get<ApiKey[]>(`${projectId}/apikeys`)
        return response ?? []
    },

    getApiKey: async (params: { projectId: string; id: number }): Promise<ApiKey> => {
        return http.get<ApiKey>(`${params.projectId}/apikeys/${params.id}`)
    },

    createApiKey: async (projectId: string): Promise<ApiKey> => {
        return http.post<ApiKey>(`${projectId}/apikeys`)
    },

    // Delete endpoint using the same URL as getApiKey
    deleteApiKey: async (params: { projectId: string; id: number }): Promise<void> => {
        await http.del(`${params.projectId}/apikeys/${params.id}`)
    },
}

// Query hook for fetching all API keys
export function useApiKeys(
    projectId: string,
    options?: Partial<UseQueryOptions<ApiKey[], Error>>
) {
    return useQuery<ApiKey[], Error>({
        queryKey: API_KEYS_KEY(projectId),
        queryFn: () => apiKeysApi.getApiKeys(projectId),
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
        ...options,
    })
}

// Query hook for fetching an individual API key
export function useApiKey(
    projectId: string,
    id: number,
    options?: Partial<UseQueryOptions<ApiKey, Error>>
) {
    const queryClient = useQueryClient()

    return useQuery<ApiKey, Error>({
        queryKey: API_KEY_KEY(projectId, id),
        queryFn: () => apiKeysApi.getApiKey({ projectId, id }),
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
        placeholderData: () => {
            const apiKeys = queryClient.getQueryData<ApiKey[]>(API_KEYS_KEY(projectId))
            return apiKeys?.find((apiKey) => apiKey.id === id)
        },
        ...options,
    })
}

// Mutation hook for creating an API key
export function useCreateApiKey(projectId: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: () => apiKeysApi.createApiKey(projectId),
        onSuccess: (newApiKey) => {
            // Update the list
            queryClient.setQueryData<ApiKey[]>(
                API_KEYS_KEY(projectId),
                (old = []) => [...old, newApiKey]
            )
            // Set an individual cache entry
            queryClient.setQueryData<ApiKey>(
                API_KEY_KEY(projectId, newApiKey.id),
                () => newApiKey
            )
        },
    })
}

// Mutation hook for deleting an API key
export function useDeleteApiKey(projectId: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: number) => apiKeysApi.deleteApiKey({ projectId, id }),
        onSuccess: (_, id) => {
            // Remove the key from the list
            queryClient.setQueryData<ApiKey[]>(
                API_KEYS_KEY(projectId),
                (old = []) => old.filter((apiKey) => apiKey.id !== id)
            )
            // Remove the individual query cache
            queryClient.removeQueries({
                queryKey: API_KEY_KEY(projectId, id),
            })
        },
    })
}
