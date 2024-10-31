import { baseUrl } from '$lib/client/client'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

const get = async <T>(url: string) =>
    request<T>('GET', url, {})

const post = async <T>(url: string, body?: any) =>
    request<T>('POST', url, {
        body: JSON.stringify(body),
        headers: {
            'Content-Type': 'application/json',
        },
    })


const request = async <T>(method: HttpMethod, url: string, init: RequestInit) => {
    const fullUrl = baseUrl + (url.startsWith('/') ? `${url}` : `/${url}`)
    const response = await fetch(fullUrl, {
        ...init,
        credentials: 'include',
        method,
    })

    const result = await response.json() as T
    return result
}

export const http = {
    get,
    post
}
