import { baseUrl } from '$lib/client/client'
import { http } from '$lib/client/fetch'
import type { Insight } from '$lib/components/insight/Insight'
import type { TrendInsight } from '$lib/components/insight/trends/TrendInsight'
import { writable } from 'svelte/store'

const createInsightStore = () => {
    const { subscribe, set, update } = writable<Insight[]>([])

    getInsights().then((insights) => set(insights))

    return {
        create: async () => {
            const response = await createInsight('New Insight')
            if (response) {
                update((insights) => [...insights, response])
            }
            return response
        },
        delete: (insightId: number) => {
            return new Promise((resolve, reject) => {
                subscribe((insights) => {
                    const insight = insights.find((i) => i.id === insightId)
                    if (!insight) return
                    update((insights) =>
                        insights.filter((i) => i.id !== insight.id),
                    )
                    resolve(insight)
                })
            })
        },
        update: async (insight: Insight) => {
            await updateInsight(insight)
            update((insights) => {
                return insights.map((i) => (i.id === insight.id ? insight : i))
            })
        },
        subscribe,
        set,
    }
}

const getInsights = async (): Promise<Insight[]> => {
    const response = await http.get<Insight[]>('/insights')
    return response ?? []
}

const createInsight = async (name: string) => {
    const response = await http.post<Insight>('/insights', {
        type: 'Trend',
        name,
        description: '',
        series: [],
    })
    return response
}
const updateInsight = async (insight: Insight) => {
    const response = await http.put<Insight>(`/insights/${insight.id}`, insight)
    return response ?? insight
}

interface InsightInput {
    name: string
    series: any[]
}

export const insightsStore = createInsightStore()
