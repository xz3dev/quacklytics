// src/stores/auth.store.ts
import {create} from 'zustand'
import {http} from "@lib/fetch.ts";
import {User} from '@/model/user';
import {Simulate} from "react-dom/test-utils";
import error = Simulate.error;

interface AuthState {
    loading: boolean
    user: User | null
    login: (email: string, password: string) => Promise<string>
    logout: () => Promise<void>
    checkAuth: () => Promise<User | null>
    setUser: (user: User | null) => void
    register: (email: string, password: string) => Promise<string>
}

export const useAuthStore = create<AuthState>((set, get) => ({
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
            return resp?.location ?? 'projects'
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
            set({user: null, loading: false})
            return null
        }
    },

    register: async (email: string, password: string) => {
        try {
            const resp = await http.post<RegisterResponse>(
                `auth/register`,
                {email, password, confirm_password: password}
            )
            const store = get()
            await store.checkAuth()
            return resp.location
        } catch (errpr) {
            console.error('Register error:', error)
            throw error
        }
    }
}))

interface RegisterResponse {
    location: string
}
