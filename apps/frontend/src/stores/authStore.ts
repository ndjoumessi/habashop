import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/lib/api'
import { useAppStore } from '@/stores/appStore'

export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER' | 'ACCOUNTANT' | 'HR' | 'SUPER_ADMIN' | 'admin' | 'manager' | 'cashier' | 'accountant' | 'hr'

// ─── RBAC ─────────────────────────────────────────────────────────────────────
// Slug = last segment of `/app/<slug>`. '*' = full access (admins).
// Pages omitted from a role's list are denied; route guard redirects to landing.
export const ROLE_PERMISSIONS: Record<string, readonly string[] | '*'> = {
  SUPER_ADMIN: '*',
  ADMIN:       '*',
  MANAGER: [
    'dashboard', 'pos', 'stock', 'customers', 'suppliers', 'orders',
    'hr', 'planning', 'payroll',
    'reports', 'forecasts', 'expenses', 'goals', 'marketing', 'ai',
    'notifications', 'activity', 'settings',
  ],
  CASHIER: [
    'dashboard', 'pos', 'stock', 'customers', 'notifications',
  ],
  ACCOUNTANT: [
    'dashboard', 'reports', 'forecasts', 'expenses', 'payroll',
    'orders', 'suppliers', 'notifications',
  ],
  HR: [
    'dashboard', 'hr', 'planning', 'payroll', 'notifications', 'activity',
  ],
}

export function canAccess(role: UserRole | undefined | null, slug: string): boolean {
  if (!role) return false
  const upper = String(role).toUpperCase()
  const perms = ROLE_PERMISSIONS[upper]
  if (perms === '*') return true
  return Array.isArray(perms) && perms.includes(slug)
}

export function getLandingForRole(role: UserRole | undefined | null): string {
  if (!role) return '/login'
  const upper = String(role).toUpperCase()
  if (upper === 'CASHIER')    return '/app/pos'
  if (upper === 'ACCOUNTANT') return '/app/reports'
  if (upper === 'HR')         return '/app/hr'
  return '/app/dashboard'
}

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
          const { token, user, tenant } = await authApi.login(email, password)
          localStorage.setItem('habashop_token', token)
          useAppStore.getState().setTenant(tenant ?? null)
          useAppStore.getState().closeCashier() // pas de session caisse héritée d'une connexion précédente
          useAppStore.getState().clearCart()    // panier vide à chaque nouvelle session
          set({ user, token, isAuthenticated: true, isLoading: false })
        } catch (err: any) {
          // Fallback démo sans backend
          const demoAccounts: Record<string, { id: string; name: string; role: UserRole }> = {
            'admin@habashop.com':      { id: 'demo-admin',      name: 'Nelson Djoumessi', role: 'ADMIN'      },
            'manager@habashop.com':    { id: 'demo-manager',    name: 'Ibrahim Touré',    role: 'MANAGER'    },
            'cashier@habashop.com':    { id: 'demo-cashier',    name: 'Aminata Touré',    role: 'CASHIER'    },
            'accountant@habashop.com': { id: 'demo-accountant', name: 'Fatou Sow',        role: 'ACCOUNTANT' },
            'hr@habashop.com':         { id: 'demo-hr',         name: 'Marie Bakayoko',   role: 'HR'         },
          }
          const demo = demoAccounts[email]
          if (demo && password === 'demo1234') {
            const demoToken = 'demo-token-local'
            localStorage.setItem('habashop_token', demoToken)
            useAppStore.getState().setTenant({
              id: 'demo-tenant-001',
              name: 'HabaShop — Dakar Central',
              plan: 'business',
              currency: 'XOF',
              country: 'SN',
              vatRate: 18,
              createdAt: new Date().toISOString(),
            })
            useAppStore.getState().closeCashier()
            useAppStore.getState().clearCart()
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
          const { token, user, tenant } = await authApi.register(data)
          localStorage.setItem('habashop_token', token)
          useAppStore.getState().setTenant(tenant ?? null)
          set({ user, token, isAuthenticated: true, isLoading: false })
        } catch (err: any) {
          set({ error: err.message, isLoading: false })
          throw err
        }
      },

      logout: () => {
        localStorage.removeItem('habashop_token')
        useAppStore.getState().clearTenant()
        useAppStore.getState().closeCashier()
        useAppStore.getState().clearCart() // panier vide — pas hérité d'une session précédente
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
