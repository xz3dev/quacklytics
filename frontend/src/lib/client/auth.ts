import { goto } from '$app/navigation'
import { baseUrl } from '$lib/client/client'
import { http } from '$lib/client/fetch'
import { get, writable } from 'svelte/store'

interface User {
    id: string
    email: string
}

function createAuthStore() {
    const { subscribe, set, update } = writable<User | null>(null)

    authService.checkAuth()
    return {
        subscribe,
        login: (user: User) => {
            set(user)
        },
        logout: () => set(null),
        update: (data: Partial<User>) =>
            update((user) => (user ? { ...user, ...data } : null)),
    }
}

export const authService = {
    async login(email: string, password: string) {
        try {
            const response:
                | {
                      location: string
                  }
                | undefined = await http.post('auth/login', { email, password })

            await this.checkAuth()
            const targetLocation = response?.location
            console.info(`Navigate to ${targetLocation} after successful login`)
            if (targetLocation) {
                await goto(targetLocation)
            }
        } catch (error) {
            console.error('Login error:', error)
            throw error
        }
    },

    async logout() {
        try {
            console.log('Logging out!')
            await http.get('auth/logout')
            authStore.logout()
        } catch (error) {
            console.error('Logout error:', error)
            throw error
        }
    },

    async checkAuth() {
        try {
            const user: User | undefined = await http.get('auth/me')
            if (user) {
                authStore.login(user)
            }
            return user
        } catch (error) {
            console.log(error)
            authStore.logout()
            return null
        }
    },
}

export const authStore = createAuthStore()
