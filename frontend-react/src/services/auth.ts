// src/stores/auth.store.ts
import {create} from 'zustand'
import {http} from "@lib/fetch.ts";
import {User} from '@/model/user';

interface AuthState {
    loading: boolean
    user: User | null
    login: (email: string, password: string) => Promise<string>
    logout: () => Promise<void>
    checkAuth: () => Promise<User | null>
    setUser: (user: User | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
    loading: true,
    user: null,
    setUser: (user) => set({user}),

    login: async (email: string, password: string) => {
        set({user: null, loading: true})
        try {
            const resp: {
                location: string
            } | undefined = await http.post(`auth/login`, {email, password})
            const user = await http.get<User>(`auth/me`)
            set({user, loading: false})
            return resp?.location ?? 'login'
        } catch (error) {
            console.error('Login error:', error)
            throw error
        }
    },

    logout: async () => {
        try {
            await http.get('auth/logout')
            set({user: null, loading: false})
        } catch (error) {
            console.error('Logout error:', error)
            throw error
        }
    },

    checkAuth: async () => {
        try {
            const user = await http.get<User>(`auth/me`)
            set({user, loading: false})
            return user ?? null
        } catch (error) {
            console.error('Auth check error:', error)
            set({user: null})
            return null
        }
    },
}))
