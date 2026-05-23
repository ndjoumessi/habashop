import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/lib/api'

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT' | 'HR' | 'SUPER_ADMIN' | 'admin' | 'manager' | 'cashier' | 'accountant' | 'hr'

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
          const demoAccounts: Record<string, { id: string; name: string; role: UserRole }> = {
            'admin@habashop.com':   { id: 'demo-admin',   name: 'Nelson Djoumessi', role: 'ADMIN'   },
            'cashier@habashop.com': { id: 'demo-cashier', name: 'Aminata Touré',    role: 'CASHIER' },
          }
          const demo = demoAccounts[email]
          if (demo && password === 'demo1234') {
            const demoToken = 'demo-token-local'
            localStorage.setItem('habashop_token', demoToken)
            set({
              user: { ...demo, email, shopName: 'HabaShop — Dakar Central' },
              token: demoToken,
              isAuthenticated: true,
              isLoading: false,
              error: null,
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
