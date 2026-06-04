import axios, { AxiosError } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { logger } from '@/lib/logger'
import type {
  LoginResponse, MeResponse,
  Product, ProductUpdate,
  SalePayload, SaleResponse, SaleRecord, RefundResponse,
  DashboardStats, Customer, TenantUser, LoyaltyResponse,
} from '@/types'

const BASE = process.env.EXPO_PUBLIC_API_URL
  ?? 'https://habashop-production.up.railway.app'

export const apiClient = axios.create({
  baseURL: BASE, timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use(async (config) => {
  try {
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

export const authApi = {
  login: (email: string, password: string): Promise<LoginResponse> =>
    apiClient.post<LoginResponse>('/api/auth/login', { email, password }).then(r => r.data),
  me: (): Promise<MeResponse> =>
    apiClient.get<MeResponse>('/api/auth/me').then(r => r.data),
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
  // Fidélité (lecture seule) — solde + palier canonique + historique. Sert au feedback
  // « +N points » après vente (delta) et à la carte fidélité honnête. AUCUN calcul mobile.
  loyalty: (id: string): Promise<LoyaltyResponse> =>
    apiClient.get<LoyaltyResponse>(`/api/customers/${id}/loyalty`).then(r => r.data),
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
