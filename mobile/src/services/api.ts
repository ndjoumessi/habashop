import axios, { AxiosError } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { logger } from '@/lib/logger'
import { DEFAULT_MARKET } from '@/lib/defaultMarket'
import type {
  LoginResponse, RawLoginResponse, MeResponse,
  TenantSummary, SwitchTenantResponse,
  Product, ProductUpdate,
  SalePayload, SaleResponse, SaleRecord, RefundResponse,
  DashboardStats, Customer, TenantUser, LoyaltyResponse, LoyaltyCardData,
} from '@/types'

/**
 * ⚠️ EXPORTÉE — l'écran Réglages affichait cette URL en DUR sous le libellé
 * « Backend », donc il annonçait la production même si `EXPO_PUBLIC_API_URL`
 * pointait ailleurs : un champ déclaré qui se fait passer pour une mesure.
 * ⚠️ `EXPO_PUBLIC_API_URL` doit rester écrite EN TOUTES LETTRES (inlining textuel).
 */
export const API_BASE = process.env.EXPO_PUBLIC_API_URL
  ?? 'https://habashop-production.up.railway.app'

/** Hôte seul, pour affichage. */
export const apiHost = (): string => API_BASE.replace(/^https?:\/\//, '').replace(/\/+$/, '')

const BASE = API_BASE

export const apiClient = axios.create({
  baseURL: BASE, timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(async (config) => {
  try {
    // Respecte un Authorization déjà posé sur la requête (ex. switch-tenant pendant le login,
    // où le token frais n'est pas encore en SecureStore) → ne l'écrase pas.
    if (config.headers.Authorization) return config
    const token = await SecureStore.getItemAsync('auth_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch (e) {
    logger.warn('Lecture du token échouée (requête envoyée non authentifiée):', e)
  }
  return config
})

// Extrait un message d'erreur lisible d'une exception axios/inconnue (sans `any`).
// Le backend renvoie typiquement { error: string }.
export function apiErrorMessage(err: unknown): string | undefined {
  const ax = err as AxiosError<{ error?: string }>
  return ax?.response?.data?.error ?? (err instanceof Error ? err.message : undefined)
}

// Code HTTP d'une erreur axios (ex. 401, 410), sans `any`.
export function apiErrorStatus(err: unknown): number | undefined {
  return (err as AxiosError)?.response?.status
}

// Code APPLICATIF renvoyé par le backend (ex. `UNKNOWN_PRODUCT`, `VALIDATION`), distinct
// du statut HTTP. Sert à dire au commerçant POURQUOI une vente n'a pas pu être enregistrée.
export function apiErrorCode(err: unknown): string | undefined {
  return (err as AxiosError<{ code?: string }>)?.response?.data?.code
}

// Une erreur mérite-t-elle un retry / une bascule offline ? OUI pour les pannes
// réseau (timeout axios = pas de `response`) et les 5xx serveur. NON pour les 4xx
// (validation/auth) — retenter une vente invalide bouclerait sans fin.
export function isRetryableApiError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false
  const status = err.response?.status
  return status === undefined || status >= 500
}

export const authApi = {
  // Login + résolution de la boutique active. Multi-boutiques v2 : un compte lié à ≠ 1
  // boutique reçoit un JWT sans boutique active → les routes tenant-scopées (dont
  // /api/dashboard/stats) renvoient 400 NO_ACTIVE_TENANT. On auto-sélectionne alors la 1ʳᵉ
  // boutique (switch-tenant → nouveau token) pour garantir un `tenant` actif au reste de l'app.
  // Comptes mono-boutique : `tenant`/`activeTenantId` déjà présents → aucun switch, inchangé.
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const raw = await apiClient
      .post<RawLoginResponse>('/api/auth/login', { email, password })
      .then(r => r.data)
    if (raw.tenant && raw.activeTenantId) {
      return { token: raw.token, user: raw.user, tenant: raw.tenant }
    }
    const first = raw.tenants?.[0]
    if (first) {
      const sw = await authApi.switchTenant(first.id, raw.token)
      return { token: sw.token, user: raw.user, tenant: sw.tenant }
    }
    // Edge : compte sans aucune boutique → tenant minimal pour ne pas crasher l'app.
    return {
      token: raw.token, user: raw.user,
      tenant: raw.tenant ?? { id: '', name: raw.user?.name ?? 'HabaShop', plan: '', currency: DEFAULT_MARKET.currency, lang: 'fr', status: 'active' },
    }
  },
  me: (): Promise<MeResponse> =>
    apiClient.get<MeResponse>('/api/auth/me').then(r => r.data),
  // Liste des boutiques accessibles (token courant). Utilisé par restoreSession pour
  // débloquer un token déjà stocké sans boutique active (fix OTA sans re-login).
  tenants: (): Promise<TenantSummary[]> =>
    apiClient.get<TenantSummary[]>('/api/auth/tenants').then(r => r.data),
  // Sélection de boutique active → nouveau JWT. `token` explicite quand le token courant
  // n'est pas encore en SecureStore (pendant le login).
  switchTenant: (tenantId: string, token?: string): Promise<SwitchTenantResponse> =>
    apiClient
      .post<SwitchTenantResponse>('/api/auth/switch-tenant', { tenantId },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then(r => r.data),
}

export const productsApi = {
  list: (params?: Record<string, string | number>): Promise<Product[]> =>
    apiClient.get<Product[]>('/api/products', { params }).then(r => r.data),
  // Backend = PUT /api/products/:id (update partiel, renvoie le produit mis à jour)
  update: (id: string, data: ProductUpdate): Promise<Product> =>
    apiClient.put<Product>(`/api/products/${id}`, data).then(r => r.data),
}

export const salesApi = {
  create: (data: SalePayload): Promise<SaleResponse> =>
    apiClient.post<SaleResponse>('/api/sales', data).then(r => r.data),
  list: (params?: Record<string, string | number>): Promise<SaleRecord[]> =>
    apiClient.get<SaleRecord[]>('/api/sales', { params }).then(r => r.data),
  // Remboursement TOTAL d'une vente (manager/admin uniquement côté backend).
  // 400 motif manquant · 403 rôle insuffisant · 404 introuvable · 409 déjà remboursée.
  refund: (id: string, body: { reason: string; restock: boolean }): Promise<RefundResponse> =>
    apiClient.post<RefundResponse>(`/api/sales/${id}/refund`, body).then(r => r.data),
}

export const analyticsApi = {
  // Endpoint réel du backend (réponse à plat : salesToday, salesMonth,
  // totalProducts, activeEmployees, pendingOrders, topProducts[], stockAlerts[]…)
  dashboard: (): Promise<DashboardStats> =>
    apiClient.get<DashboardStats>('/api/dashboard/stats').then(r => r.data),
}

export const customersApi = {
  list: (): Promise<Customer[]> =>
    apiClient.get<Customer[]>('/api/customers').then(r => r.data),
  get: (id: string): Promise<Customer> =>
    apiClient.get<Customer>(`/api/customers/${id}`).then(r => r.data),
  // Fidélité (lecture seule) — solde + palier canonique + historique + remises v2.
  loyalty: (id: string): Promise<LoyaltyResponse> =>
    apiClient.get<LoyaltyResponse>(`/api/customers/${id}/loyalty`).then(r => r.data),
  // Carte fidélité numérique (scope tenant strict, tout rôle).
  loyaltyCard: (id: string): Promise<LoyaltyCardData> =>
    apiClient.get<LoyaltyCardData>(`/api/customers/${id}/loyalty-card`).then(r => r.data),
}

export const accountApi = {
  // Liste des users du tenant (rôles inclus) → sert à anticiper le scope de suppression.
  // ⚠️ le backend ne filtre pas deletedAt sur cette route → on filtre côté client.
  tenantUsers: (): Promise<TenantUser[]> =>
    apiClient.get<TenantUser[]>('/api/tenant/users').then(r => r.data),
  // Suppression de compte (DELETE avec body via axios `data`).
  deleteMe: (body: { confirmation: string; password: string }): Promise<{ success?: boolean }> =>
    apiClient.delete('/api/account/me', { data: body }).then(r => r.data),
}
