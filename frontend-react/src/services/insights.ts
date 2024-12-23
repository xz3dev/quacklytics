// src/stores/insights.store.ts
import { create } from 'zustand'
import { http } from '@/lib/fetch'
import { Insight } from '@/model/insight'

interface InsightsState {
    insights: Insight[]
    isLoading: boolean
    error: string | null
    fetchInsights: () => Promise<void>
    createInsight: (name: string) => Promise<Insight | undefined>
    deleteInsight: (insightId: number) => Promise<void>
    updateInsight: (insight: Insight) => Promise<void>
}

export const useInsightsStore = create<InsightsState>((set) => ({
    insights: [],
    isLoading: false,
    error: null,

    fetchInsights: async () => {
        set({ isLoading: true, error: null })
        try {
            const response = await http.get<Insight[]>('/insights')
            set({ insights: response ?? [], isLoading: false })
        } catch (error) {
            set({
                error: 'Failed to fetch insights',
                isLoading: false
            })
            console.error('Fetch insights error:', error)
        }
    },

    createInsight: async (name: string) => {
        try {
            const newInsight = await http.post<Insight>('/insights', {
                type: 'Trend',
                name,
                description: '',
                series: [],
            })

            if (newInsight) {
                set((state) => ({
                    insights: [...state.insights, newInsight]
                }))
            }

            return newInsight
        } catch (error) {
            console.error('Create insight error:', error)
            set({ error: 'Failed to create insight' })
        }
    },

    deleteInsight: async (insightId: number) => {
        try {
            set((state) => ({
                insights: state.insights.filter(i => i.id !== insightId)
            }))
        } catch (error) {
            console.error('Delete insight error:', error)
            set({ error: 'Failed to delete insight' })
        }
    },

    updateInsight: async (insight: Insight) => {
        try {
            const updated = await http.put<Insight>(
                `/insights/${insight.id}`,
                insight
            )

            set((state) => ({
                insights: state.insights.map(i =>
                    i.id === insight.id ? (updated ?? insight) : i
                )
            }))
        } catch (error) {
            console.error('Update insight error:', error)
            set({ error: 'Failed to update insight' })
        }
    },
}))
