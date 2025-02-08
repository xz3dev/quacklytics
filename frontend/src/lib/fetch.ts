import {baseUrl} from "@app/conf.ts";

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

const get = async <T>(url: string) => request<T>('GET', url, {})
const del = async <T>(url: string) => request<T>('DELETE', url, {})

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

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} : ${response.statusText}`)
    }

    try {
        const result = (await response.json()) as T
        return result
    } catch (e) {
        throw new Error(`Cannot unmarshal response: ${e}`)
    }
}

const getBlob = async (url: string, init?: RequestInit) => {
    const fullUrl = baseUrl + (url.startsWith('/') ? `${url}` : `/${url}`)
    const response = await fetch(fullUrl, {
        ...init,
        credentials: 'include',
        method: 'GET',
    })

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} : ${response.statusText}`)
    }

    return response.blob()
}

export const http = {
    get,
    post,
    put,
    del,
    getBlob,
}
