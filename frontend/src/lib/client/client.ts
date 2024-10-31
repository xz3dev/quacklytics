import type { Insight } from '$lib/components/insight/Insight'

export const baseUrl = 'http://localhost:3000'

export class AnalyticsClient {
    constructor() {

    }
}

const getInsights = async (): Promise<Insight[]> => {
    const response = await fetch(`${baseUrl}/insights`)
    return response.json()
}
