import { writable } from 'svelte/store'
import type { Insight } from '$lib/components/insight/Insight'
import { baseUrl } from '$lib/client/client'
import { http } from '$lib/client/fetch'

const createInsightStore = () => {
    const { subscribe, set, update } = writable<Insight[]>([])

    getInsights().then(insights => set(insights))

    return {
        create: async (insight: Insight) => {
            const response = await createInsight(insight)
            update(insights => [...insights, response])
        },
        delete: (insightId: number) => {
            return new Promise((resolve, reject) => {
                subscribe((insights) => {
                    const insight = insights.find(i => i.id === insightId)
                    if (!insight) return
                    update(insights => insights.filter(i => i.id !== insight.id))
                    resolve(insight)
                })
            })
        },
        subscribe,
        set,
    }
}

const getInsights = async (): Promise<Insight[]> => {
    const response = await http.get<Insight[]>(`/insights`)
    return response ?? []
}

const createInsight = async (insight: Insight) => {
    const response = await http.post<Insight>(`/insights`, insight)
    return response ?? insight
}

interface InsightInput {
    name: string
    series: any[]
}


export const insightsStore = createInsightStore()
