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

const login = async (email: string, password: string) => {
    const response = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            password,
        }),
    })
    if (!response.ok) {
        throw new Error('Login failed')
    }
    const data = await response.json() as LoginResponse
    console.log(data)
}

interface LoginResponse {
    localation: string
    status: string
}
