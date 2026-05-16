import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/lib/api'

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT' | 'HR' | 'admin' | 'manager' | 'cashier' | 'accountant' | 'hr'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  shopName: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => void
  updateUser: (data: Partial<User>) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { token, user } = await authApi.login(email, password)
          localStorage.setItem('habashop_token', token)
          set({ user, token, isAuthenticated: true, isLoading: false })
        } catch (err: any) {
          // Fallback démo sans backend
          if (email === 'admin@habashop.com' && password === 'demo1234') {
            set({
              user: { id: 'demo', name: 'Nelson Djoumessi', email, role: 'admin', shopName: 'HabaShop — Dakar Central' },
              token: 'demo-token',
              isAuthenticated: true,
              isLoading: false,
            })
            return
          }
          set({ error: err.message, isLoading: false })
          throw err
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const { token, user } = await authApi.register(data)
          localStorage.setItem('habashop_token', token)
          set({ user, token, isAuthenticated: true, isLoading: false })
        } catch (err: any) {
          set({ error: err.message, isLoading: false })
          throw err
        }
      },

      logout: () => {
        localStorage.removeItem('habashop_token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      updateUser: (data) => {
        set((state) => ({ user: state.user ? { ...state.user, ...data } : null }))
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'habashop-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
