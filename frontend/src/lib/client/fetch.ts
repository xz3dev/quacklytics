import { baseUrl } from '$lib/client/client'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

const get = async <T>(url: string) => request<T>('GET', url, {})

const post = async <T>(url: string, body?: unknown) =>
    request<T>('POST', url, {
        body: body ? JSON.stringify(body) : null,
        headers: {
            'Content-Type': 'application/json',
        },
    })

const put = async <T>(url: string, body?: unknown) =>
    request<T>('PUT', url, {
        body: body ? JSON.stringify(body) : null,
        headers: {
            'Content-Type': 'application/json',
        },
    })

const request = async <T>(
    method: HttpMethod,
    url: string,
    init: RequestInit,
) => {
    const fullUrl = baseUrl + (url.startsWith('/') ? `${url}` : `/${url}`)
    const response = await fetch(fullUrl, {
        ...init,
        credentials: 'include',
        method,
    })

    try {
        const result = (await response.json()) as T
        return result
    } catch (e) {
        console.error(`Cannot unmarshal response: ${e}`)
    }
    return undefined
}

export const http = {
    get,
    post,
    put,
}
