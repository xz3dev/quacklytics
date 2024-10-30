import { writable } from 'svelte/store'
import { baseUrl } from '$lib/client/client'
import { goto } from '$app/navigation'

interface User {
    id: string;
    email: string;
}

function createAuthStore() {
    const { subscribe, set, update } = writable<User | null>(null)

    return {
        subscribe,
        login: (user: User) => set(user),
        logout: () => set(null),
        update: (data: Partial<User>) => update(user => user ? { ...user, ...data } : null),
    }
}

export const authStore = createAuthStore()

export const authService = {
    async login(email: string, password: string) {
        try {
            const response = await fetch(`${baseUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })

            const body = await response.json()


            const userResp = await fetch(`${baseUrl}/auth/me`, {
                method: 'GET',
            })
            const user = await userResp.json()
            authStore.login(user)
            console.log(user)
            const targetLocation = body['location']
            await goto(targetLocation)
            return user
        } catch (error) {
            console.error('Login error:', error)
            throw error
        }
    },

    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
            authStore.logout()
        } catch (error) {
            console.error('Logout error:', error)
            throw error
        }
    },

    async checkAuth() {
        try {
            const response = await fetch('/api/auth/me')
            if (!response.ok) throw new Error('Not authenticated')

            const user = await response.json()
            // authStore.login(user);
            return user
        } catch (error) {
            authStore.logout()
            return null
        }
    },
}
