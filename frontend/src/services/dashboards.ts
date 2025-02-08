import {useQuery, useMutation, useQueryClient, type UseQueryOptions} from '@tanstack/react-query'
import {http} from '@/lib/fetch'
import {Dashboard, DashboardInput} from "@/model/dashboard.ts";

export const DASHBOARDS_KEY = (project: string) => ['dashboards', project] as const
export const DASHBOARD_KEY = (project: string, id: number) =>
    [...DASHBOARDS_KEY(project), id] as const

const dashboardsApi = {
    getDashboards: async (project: string): Promise<Dashboard[]> => {
        const response = await http.get<Dashboard[]>(`${project}/dashboards`)
        return response ?? []
    },

    createDashboard: async (params: { project: string, data: DashboardInput }): Promise<Dashboard> => {
        return http.post<Dashboard>(`${params.project}/dashboards`, params.data)
    },

    deleteDashboard: async (params: { project: string, dashboardId: number }): Promise<void> => {
        await http.del(`${params.project}/dashboards/${params.dashboardId}`)
    },

    updateDashboard: async (params: { project: string, dashboard: Dashboard }): Promise<Dashboard> => {
        return http.put<Dashboard>(`${params.project}/dashboards/${params.dashboard.id}`, params.dashboard)
    },

    getDashboard: async (params: { project: string | number, id: number }): Promise<Dashboard> => {
        return http.get<Dashboard>(`${params.project}/dashboards/${params.id}`)
    },

    setDashboardInsights: async (params: {
        project: string,
        dashboardId: number,
        insightIds: number[]
    }): Promise<Dashboard> => {
        return http.put<Dashboard>(
            `${params.project}/dashboards/${params.dashboardId}/insights`,
            { insight_ids: params.insightIds }
        )
    },

    setHomeDashboard: async (params: {
        project: string,
        dashboardId: number
    }): Promise<Dashboard> => {
        return http.put<Dashboard>(
            `${params.project}/dashboards/${params.dashboardId}/home`
        )
    },
}

// Query hook with options
export function useDashboards(
    project: string,
    options?: Partial<UseQueryOptions<Dashboard[], Error>>
) {
    return useQuery<Dashboard[], Error>({
        queryKey: DASHBOARDS_KEY(project),
        queryFn: () => dashboardsApi.getDashboards(project),
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
        ...options,
    })
}

// Mutation hooks
export function useCreateDashboard(project: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: DashboardInput) => dashboardsApi.createDashboard({project, data}),
        onSuccess: (newDashboard) => {
            queryClient.setQueryData<Dashboard[]>(
                DASHBOARDS_KEY(project),
                (old = []) => [...old, newDashboard]
            )
            queryClient.setQueryData<Dashboard>(
                DASHBOARD_KEY(project, newDashboard.id),
                () => newDashboard
            )
        },
    })
}

export function useDeleteDashboard(project: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (dashboardId: number) => dashboardsApi.deleteDashboard({project, dashboardId}),
        onSuccess: (_, dashboardId) => {
            queryClient.setQueryData<Dashboard[]>(
                DASHBOARD_KEY(project, dashboardId),
                (old = []) => old.filter(dashboard => dashboard.id !== dashboardId)
            )
        },
    })
}

export function useUpdateDashboard(project: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (dashboard: Dashboard) => dashboardsApi.updateDashboard({project, dashboard}),
        onSuccess: (updatedDashboard) => {
            queryClient.setQueryData<Dashboard[]>(
                DASHBOARDS_KEY(project),
                (old) => old?.map((o) => o.id === updatedDashboard.id ? updatedDashboard : o),
            )
            queryClient.setQueryData<Dashboard>(
                DASHBOARD_KEY(project, updatedDashboard.id),
                () => updatedDashboard,
            )
        },
    })
}

export function useDashboard(
    project: string,
    dashboardId: number,
    options?: Partial<UseQueryOptions<Dashboard, Error>>
) {
    const queryClient = useQueryClient()

    return useQuery<Dashboard, Error>({
        queryKey: DASHBOARD_KEY(project, dashboardId),
        queryFn: () => dashboardsApi.getDashboard({project, id: dashboardId}),
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: true,
        placeholderData: () => {
            const dashboards = queryClient.getQueryData<Dashboard[]>(DASHBOARDS_KEY(project))
            return dashboards?.find(dashboard => dashboard.id === dashboardId)
        },
        ...options,
    })
}

export function useSetDashboardInsights(project: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (params: { dashboardId: number, insightIds: number[] }) =>
            dashboardsApi.setDashboardInsights({
                project,
                dashboardId: params.dashboardId,
                insightIds: params.insightIds
            }),
        onSuccess: (updatedDashboard) => {
            // Update the dashboard in the dashboards list
            queryClient.setQueryData<Dashboard[]>(
                DASHBOARDS_KEY(project),
                (old) => old?.map((o) =>
                    o.id === updatedDashboard.id ? updatedDashboard : o
                ),
            )

            // Update the individual dashboard cache
            queryClient.setQueryData<Dashboard>(
                DASHBOARD_KEY(project, updatedDashboard.id),
                () => updatedDashboard,
            )
        },
    })
}

export function useSetHomeDashboard(project: string) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (dashboardId: number) =>
            dashboardsApi.setHomeDashboard({
                project,
                dashboardId
            }),
        onSuccess: (updatedDashboard) => {
            // Update the dashboards list, ensuring only one dashboard has home=true
            queryClient.setQueryData<Dashboard[]>(
                DASHBOARDS_KEY(project),
                (old = []) => old.map((dashboard) => ({
                    ...dashboard,
                    home: dashboard.id === updatedDashboard.id
                }))
            )

            // Update the individual dashboard cache
            queryClient.setQueryData<Dashboard>(
                DASHBOARD_KEY(project, updatedDashboard.id),
                () => updatedDashboard
            )
        },
    })
}
