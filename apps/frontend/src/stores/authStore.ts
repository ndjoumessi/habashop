import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi, type AccessibleTenant } from '@/lib/api'
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
    // 'activity' (journal d'audit) retiré : peut contenir des actions hors-RH
    // (ventes, paie d'autrui) → réservé MANAGER+ / ADMIN.
    'dashboard', 'hr', 'planning', 'payroll', 'notifications',
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

// Atterrissage à la connexion. ⚠️ Le critère `isPlatformAdmin` prime EN PARALLÈLE du rôle
// (jamais À LA PLACE) : un opérateur SaaS atterrit sur sa console `/admin`, pas dans l'app
// commerçant. `getLandingForRole` (basé rôle) reste INTACT → aucun impact sur les commerçants.
export function landingFor(user: { role?: UserRole | null; isPlatformAdmin?: boolean } | null | undefined): string {
  if (user?.isPlatformAdmin === true) return '/admin'
  return getLandingForRole(user?.role)
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  shopName: string
  // Admin PLATEFORME (super-admin SaaS) — seul critère du panneau /admin. Distinct du
  // rôle tenant SUPER_ADMIN. Masquage UI seulement ; le gate autoritaire est côté serveur.
  isPlatformAdmin?: boolean
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  // Multi-boutiques
  tenants: AccessibleTenant[]          // boutiques accessibles à l'user
  activeTenantId: string | null        // null = aucune boutique sélectionnée (sélecteur requis)
  login: (email: string, password: string) => Promise<void>
  register: (data: any) => Promise<void>
  switchTenant: (tenantId: string) => Promise<void>
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
      tenants: [],
      activeTenantId: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { token, user, tenant, tenants, activeTenantId } = await authApi.login(email, password)
          localStorage.setItem('habashop_token', token)
          // 1 boutique → tenant fourni ; >1 → tenant null (sélecteur affiché avant l'entrée).
          useAppStore.getState().setTenant(tenant ?? null)
          useAppStore.getState().closeCashier() // pas de session caisse héritée d'une connexion précédente
          useAppStore.getState().clearCart()    // panier vide à chaque nouvelle session
          set({
            user, token, isAuthenticated: true, isLoading: false,
            tenants: tenants ?? [],
            activeTenantId: activeTenantId ?? null,
          })
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
          set({
            user, token, isAuthenticated: true, isLoading: false,
            tenants: tenant ? [{ id: tenant.id, name: tenant.name, currency: tenant.currency, plan: tenant.plan, logo: tenant.logo ?? null, address: tenant.address ?? null, role: 'ADMIN' }] : [],
            activeTenantId: tenant?.id ?? null,
          })
        } catch (err: any) {
          set({ error: err.message, isLoading: false })
          throw err
        }
      },

      // Bascule de boutique active : nouveau JWT, MAJ stores. Le caller rafraîchit
      // les données par un rechargement complet (navigation window.location).
      switchTenant: async (tenantId) => {
        const { token, tenant, role } = await authApi.switchTenant(tenantId)
        localStorage.setItem('habashop_token', token)
        useAppStore.getState().setTenant(tenant ?? null)
        useAppStore.getState().closeCashier() // session caisse propre à chaque boutique
        useAppStore.getState().clearCart()
        set((state) => ({
          token,
          activeTenantId: tenantId,
          user: state.user ? { ...state.user, role: (role as UserRole) ?? state.user.role, shopName: tenant?.name ?? state.user.shopName } : state.user,
        }))
      },

      logout: () => {
        localStorage.removeItem('habashop_token')
        useAppStore.getState().clearTenant()
        useAppStore.getState().closeCashier()
        useAppStore.getState().clearCart() // panier vide — pas hérité d'une session précédente
        set({ user: null, token: null, isAuthenticated: false, tenants: [], activeTenantId: null })
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
        tenants: state.tenants,
        activeTenantId: state.activeTenantId,
      }),
    }
  )
)
