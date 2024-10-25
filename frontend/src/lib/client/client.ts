import type { Insight } from '$lib/components/insight/Insight'

const baseUrl = 'http://localhost:3000'

export class AnalyticsClient {
    constructor(
    ) {

    }

    async getInsights(): Promise<Insight[]> {
        const response = await fetch(`${baseUrl}/insights`)
        return response.json()
    }
}
