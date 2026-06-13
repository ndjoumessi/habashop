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
    'subscriptions', 'hr', 'planning', 'payroll',
    'reports', 'forecasts', 'expenses', 'goals', 'marketing', 'ai',
    'notifications', 'activity', 'settings',
  ],
  CASHIER: [
    'dashboard', 'pos', 'stock', 'customers', 'subscriptions', 'notifications',
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
          // ⚠️ PAS de fallback démo « hors-ligne » ici. Les 5 comptes démo existent dans le backend
          // réel (mot de passe demo1234) → un login normal renvoie un VRAI JWT. L'ancien fallback
          // posait un token factice NON authentifiable quand authApi.login échouait (réseau / backend
          // down / 429 rate-limit) → tous les appels authentifiés partaient sans Authorization → 401 →
          // l'intercepteur 401 effaçait le token et redirigeait vers /login (= déconnexion immédiate
          // après « login »). On surface l'erreur à la place : l'utilisateur reste sur /login avec un
          // message clair (ex. « Trop de tentatives »).
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
