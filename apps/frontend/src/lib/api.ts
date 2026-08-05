import { logger } from '@/lib/logger'
import type { ApiSupplier, SupplierCreate, SupplierWrite } from '@/components/suppliers/suppliersShared'
import type { ApiOrder, OrderWrite } from '@/components/orders/ordersShared'
import type { ApiCustomer, ApiCustomerSearchHit, ApiCustomerSale, CustomerWrite } from '@/components/customers/customersShared'
import type { ApiProduct, ProductWrite } from '@/components/stock/stockShared'
import type { ApiEmployee, EmployeeWrite } from '@/components/hr/hrShared'
import type { ApiSupplierOrder } from '@/components/suppliers/suppliersShared'

const BASE_URL: string = (import.meta as any).env?.VITE_API_URL
  ?? 'https://habashop-production.up.railway.app'

function getToken(): string | null {
  const sources = [
    () => localStorage.getItem('habashop_token'),
    () => {
      const stored = localStorage.getItem('habashop-auth')
      if (!stored) return null
      const parsed = JSON.parse(stored)
      return parsed?.state?.token ?? null
    },
    () => sessionStorage.getItem('habashop_token'),
  ]
  for (const source of sources) {
    try {
      const token = source()
      if (token && token !== 'null' && token !== 'undefined') {
        return token
      }
    } catch {}
  }
  return null
}

/**
 * Récupère un PDF (endpoint authentifié JWT) et l'ouvre dans un nouvel onglet.
 * window.open direct n'enverrait pas l'Authorization → on fetch en blob d'abord.
 */
export async function openAuthedPdf(path: string): Promise<void> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error(`Erreur ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Télécharge un fichier (CSV, PDF…) depuis un endpoint JWT-authentifié. */
export async function downloadAuthedFile(path: string, filename: string): Promise<void> {
  const token = getToken()
  const res = await fetch(`${BASE_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new Error(`Erreur ${res.status}`)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const url = BASE_URL + path
  // DEV-only ; ne logge JAMAIS la valeur du token, seulement sa présence (booléen).
  logger.log(`API ${method} ${path} | token: ${token ? '✅' : '❌'}`)

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (res.status === 401) {
      console.warn('Token expiré → login')
      localStorage.removeItem('habashop_token')
      localStorage.removeItem('habashop-auth')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      throw new Error('Session expirée — reconnectez-vous')
    }

    if (res.status === 404) {
      throw new Error(`Route non trouvée: ${path}`)
    }

    if (!res.ok) {
      const errText = await res.text()
      let errMsg = `Erreur ${res.status}`
      try {
        const errJson = JSON.parse(errText)
        errMsg = errJson.error ?? errJson.message ?? errMsg
      } catch {}
      // Expose le status HTTP sur l'Error (ex. 409 déjà remboursé, 403 RBAC) → handlers ciblés.
      const err = new Error(errMsg) as Error & { status?: number }
      err.status = res.status
      throw err
    }

    const text = await res.text()
    if (!text) return {} as T
    return JSON.parse(text)
  } catch (err: any) {
    if (err.message?.includes('fetch')) {
      throw new Error('Impossible de contacter le serveur')
    }
    throw err
  }
}

export const api = {
  get:    <T>(path: string) => request<T>('GET', path),
  post:   <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
}

export interface AccessibleTenant {
  id: string
  name: string
  currency: string
  plan: string
  logo: string | null
  address: string | null
  role: string
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{token:string; user:any; tenant?:any; tenants?: AccessibleTenant[]; activeTenantId?: string | null}>('/api/auth/login', { email, password }),
  me: () => api.get<any>('/api/auth/me'),
  register: (data: any) => api.post<{token:string; user:any; tenant?:any}>('/api/auth/register', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<{ success: boolean; message: string }>('/api/auth/password', { currentPassword, newPassword }),
  // Multi-boutiques
  tenants: () => api.get<AccessibleTenant[]>('/api/auth/tenants'),
  switchTenant: (tenantId: string) =>
    api.post<{ token: string; tenant: any; activeTenantId: string; role: string }>('/api/auth/switch-tenant', { tenantId }),
  createTenant: (data: { name: string; currency?: string; lang?: string; address?: string; country?: string; phone?: string }) =>
    api.post<{ tenant: any }>('/api/tenants', data),
  inviteToTenant: (tenantId: string, data: { name?: string; email: string; password?: string; role?: string }) =>
    api.post<{ linked?: boolean; created?: boolean; userId?: string; user?: any }>(`/api/tenants/${tenantId}/invite`, data),
}

export const consolidatedApi = {
  get: () => api.get<{
    tenants: { id: string; name: string; currency: string; caToday: number; transactionsToday: number; stockAlerts: number }[]
    totalCaToday: number
    totalTransactions: number
  }>('/api/dashboard/consolidated'),
}

export const productsApi = {
  list:     () => api.get<ApiProduct[]>('/api/products'),
  create:   (data: ProductWrite) => api.post<ApiProduct>('/api/products', data),
  update:   (id: string, data: ProductWrite) => api.put<ApiProduct>(`/api/products/${id}`, data),
  // `DELETE` rend `{ success: true }` (soft delete) — pas le produit supprimé.
  delete:   (id: string) => api.delete<{ success: boolean }>(`/api/products/${id}`),
  lowStock: () => api.get<ApiProduct[]>('/api/products/low-stock'),
  /**
   * Résolution CIBLÉE d'un code scanné absent du cache local (Chantier B).
   * UN produit (~600 o), jamais la liste (~22 Ko gz pour 500 réf.). `null` si le
   * serveur ne le connaît pas — l'appelant ne doit PAS en conclure « n'existe pas ».
   */
  lookup: (code: string): Promise<ApiProduct | null> =>
    api.get<ApiProduct>(`/api/products/lookup?code=${encodeURIComponent(code)}`).catch(() => null),
}

export interface StockTransfer {
  id: string
  fromTenantId: string
  toTenantId: string
  productId: string
  quantity: number
  status: 'pending' | 'completed' | 'cancelled'
  note: string | null
  createdBy: string
  confirmedBy: string | null
  createdAt: string
  product?: { id: string; name: string; sku: string; emoji?: string }
  fromTenant?: { id: string; name: string }
  toTenant?: { id: string; name: string }
}

export const stockTransfersApi = {
  list:    (status?: string) => api.get<StockTransfer[]>(`/api/stock/transfers${status ? `?status=${status}` : ''}`),
  create:  (data: { toTenantId: string; productId: string; quantity: number; note?: string }) =>
    api.post<StockTransfer>('/api/stock/transfers', data),
  confirm: (id: string) => api.patch<{ id: string; status: string }>(`/api/stock/transfers/${id}/confirm`, {}),
  cancel:  (id: string) => api.patch<{ id: string; status: string }>(`/api/stock/transfers/${id}/cancel`, {}),
}

export const salesApi = {
  // opts.priceDivergence → n'renvoie que les ventes avec un écart prix soumis/catalogue (audit ADMIN).
  // opts.pricingHonored → ventes dont une ligne a été facturée au montant SOUMIS (rejeu honoré).
  // ⚠️ Filtre SERVEUR : filtrer côté client ne verrait que la page chargée (50), donc un écart
  // honoré ancien serait introuvable — la trace doit rester retrouvable quel que soit son âge.
  list:   (opts?: { priceDivergence?: boolean; pricingHonored?: boolean }) => {
    const qs = [opts?.priceDivergence && 'priceDivergence=true', opts?.pricingHonored && 'pricingHonored=true'].filter(Boolean).join('&')
    return api.get<any[]>(`/api/sales${qs ? `?${qs}` : ''}`)
  },
  create: (data: any) => api.post<any>('/api/sales', data),
  refund: (id: string, data: { reason: string; restock: boolean }) =>
    api.post<{ ok: boolean; id: string; status: string; restocked: boolean }>(`/api/sales/${id}/refund`, data),
  openInvoice: (id: string) => openAuthedPdf(`/api/sales/${id}/invoice`),
}

export const mtnMomoApi = {
  request: (data: { amount: number; phoneNumber: string; saleId?: string }) =>
    api.post<{ referenceId: string; status: 'PENDING' }>('/api/payments/mtn/request', data),
  status: (referenceId: string) =>
    api.post<{ referenceId: string; status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' }>('/api/payments/mtn/status', { referenceId }),
}

export const campayApi = {
  request: (data: { amount: number; phoneNumber: string; operator: 'orange' | 'mtn'; saleId?: string }) =>
    api.post<{ reference: string; status: 'PENDING' }>('/api/payments/campay/request', data),
  status: (reference: string) =>
    api.post<{ reference: string; status: 'PENDING' | 'SUCCESSFUL' | 'FAILED' }>('/api/payments/campay/status', { reference }),
  cardLink: (data: { amount: number }) =>
    api.post<{ paymentUrl: string; reference: string }>('/api/payments/campay/card-link', data),
}

export const paydunyaApi = {
  config: () =>
    api.get<{ configured: boolean; mode: 'test' | 'live'; methods: string[] }>('/api/payments/paydunya/config'),
  initiate: (data: { amount: number; description?: string }) =>
    api.post<{ token: string; redirectUrl: string }>('/api/payments/paydunya/initiate', data),
  // statut normalisé PayDunya : completed | pending | cancelled | failed
  status: (token: string) =>
    api.get<{ status: 'completed' | 'pending' | 'cancelled' | 'failed' }>(`/api/payments/paydunya/status/${encodeURIComponent(token)}`),
}

export interface ProviderStat { count: number; amountXof: number; lastAt: string | null }
export const paymentStatsApi = {
  // Transactions MTN MoMo + Campay du jour (montants en XOF base → convertir à l'affichage).
  today: () => api.get<{ mtn: ProviderStat; campay: ProviderStat; paydunya: ProviderStat }>('/api/payments/today-stats'),
}

export const ticketZApi = {
  today:    () => api.get<any>('/api/ticket-z/today'),
  history:  () => api.get<any[]>('/api/ticket-z/history'),
  generate: () => api.post<any>('/api/ticket-z/generate', {}),
  openPdf:  (id: string) => openAuthedPdf(`/api/ticket-z/${id}/pdf`),
}

export const customersApi = {
  list:   () => api.get<ApiCustomer[]>('/api/customers'),
  // Recherche (sélecteur POS) : ≥2 chars, max 8 résultats, chaque résultat enrichi de `tier`.
  // ⚠️ SEULE cette route porte `tier` → type distinct, cf. `customersShared`.
  search: (q: string) => api.get<ApiCustomerSearchHit[]>(`/api/customers?search=${encodeURIComponent(q)}`),
  get:    (id: string) => api.get<ApiCustomer>(`/api/customers/${id}`),
  // Historique d'achats (#214) — ⚠️ type de FRONTIÈRE `ApiCustomerSale`, pas `Purchase` :
  // `mapApiCustomerSale` traverse (ref/date/refunded). 50 lignes max, plus récentes d'abord.
  sales:  (id: string) => api.get<ApiCustomerSale[]>(`/api/customers/${id}/sales`),
  create: (data: CustomerWrite) => api.post<ApiCustomer>('/api/customers', data),
  update: (id: string, data: CustomerWrite) => api.put<ApiCustomer>(`/api/customers/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/customers/${id}`),
}

// ⚠️ Types de FRONTIÈRE (`ApiSupplier` / `SupplierWrite`), pas le type d'interface
// `Supplier` : sur le fil, `categories` est une CHAÎNE, et c'est `mapApiSupplier` qui la
// recompose en `string[]`. Typer ces retours `Supplier[]` nierait cette traversée et
// laisserait le compilateur accepter un tableau vers POST/PUT, que le serveur refuse en
// 400 (zod `z.string().nullish()`). Cf. le bloc de commentaire de `suppliersShared`.
export const suppliersApi = {
  list:   () => api.get<ApiSupplier[]>('/api/suppliers'),
  create: (data: SupplierCreate) => api.post<ApiSupplier>('/api/suppliers', data),
  update: (id: string, data: SupplierWrite) => api.put<ApiSupplier>(`/api/suppliers/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/suppliers/${id}`),
  // Historique des commandes (#214) — ⚠️ type de FRONTIÈRE `ApiSupplierOrder`, pas
  // `SupplierOrder` : `mapApiSupplierOrder` traverse. 50 lignes max, plus récentes d'abord.
  orders: (id: string) => api.get<ApiSupplierOrder[]>(`/api/suppliers/${id}/orders`),
  scanInvoice: async (file: File): Promise<any> => {
    const token = getToken()
    const fd = new FormData()
    fd.append('invoice', file)
    const res = await fetch(`${BASE_URL}/api/suppliers/scan-invoice`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as any).error ?? `Erreur ${res.status}`)
    }
    return res.json()
  },
}

// ⚠️ Type de FRONTIÈRE (`ApiOrder`), pas le domaine `Order` : sur le fil,
// `supplier` est l'objet fournisseur ENTIER (ligne Prisma brute), `items[]` porte
// `productName` et `status` est en anglais. `mapApiOrder` traverse — cf. `ordersShared`.
// ⚠️ `create` ne rend PAS la même forme que `list` : le POST fait `include: { items: true }`
// SANS `supplier`. D'où `Omit<ApiOrder, 'supplier'>`, et non `ApiOrder`.
export const ordersApi = {
  list:         () => api.get<ApiOrder[]>('/api/orders'),
  // ⚠️ Le CORPS est typé `OrderWrite` : c'est ce qui empêche de renvoyer les lignes du
  // formulaire telles quelles (sans `product` ni `unitPrice`), ce qui faisait 400 sur CHAQUE
  // création — 0 commande en base. Passer par `toOrderPayload`. Le RETOUR est mesuré : le
  // POST fait `include: { items: true }` SANS `supplier`.
  create:       (data: OrderWrite) => api.post<Omit<ApiOrder, 'supplier'>>('/api/orders', data),
  updateStatus: (id: string, status: string) =>
    api.patch<Omit<ApiOrder, 'supplier' | 'items'>>(`/api/orders/${id}/status`, { status }),
}

export const employeesApi = {
  list:   () => api.get<ApiEmployee[]>('/api/employees'),
  create: (data: EmployeeWrite) => api.post<ApiEmployee>('/api/employees', data),
  update: (id: string, data: EmployeeWrite) => api.put<ApiEmployee>(`/api/employees/${id}`, data),
  // Suppression DURE côté serveur (`prisma.employee.delete`) → `{ success: true }`.
  delete: (id: string) => api.delete<{ success: boolean }>(`/api/employees/${id}`),
}

// Bulletins de paie PERSISTÉS. ⚠️ `month` = clé ISO « YYYY-MM » (cf. `monthKey`) — le
// libellé d'écran est refusé par le serveur en 400, volontairement.
export const payrollApi = {
  list:      (month: string) => api.get<any[]>(`/api/payroll?month=${encodeURIComponent(month)}`),
  generate:  (month: string) => api.post<{ created: number; rows: any[] }>('/api/payroll/generate', { month }),
  setStatus: (id: string, status: string) => api.patch<any>(`/api/payroll/${id}`, { status }),
}

export const bonusesApi = {
  list:             () => api.get<any[]>('/api/bonuses'),
  listByEmployee:   (employeeId: string) => api.get<any[]>(`/api/bonuses/employee/${employeeId}`),
  create:           (data: any) => api.post<any>('/api/bonuses', data),
  delete:           (id: string) => api.delete<any>(`/api/bonuses/${id}`),
}

export const salaryHistoryApi = {
  list:           () => api.get<any[]>('/api/salary-history'),
  listByEmployee: (employeeId: string) => api.get<any[]>(`/api/salary-history/employee/${employeeId}`),
  create:         (data: any) => api.post<any>('/api/salary-history', data),
  delete:         (id: string) => api.delete<any>(`/api/salary-history/${id}`),
}

export const subscriptionsApi = {
  list:       ()                       => api.get<any[]>('/api/subscriptions'),
  due:        ()                       => api.get<any[]>('/api/subscriptions/due'),
  byCustomer: (customerId: string)     => api.get<any[]>(`/api/subscriptions/customer/${customerId}`),
  create:     (data: any)              => api.post<any>('/api/subscriptions', data),
  update:     (id: string, data: any)  => api.put<any>(`/api/subscriptions/${id}`, data),
  delete:     (id: string)             => api.delete<void>(`/api/subscriptions/${id}`),
}

export const goalsApi = {
  list:   ()                       => api.get<any[]>('/api/goals'),
  create: (data: any)              => api.post<any>('/api/goals', data),
  update: (id: string, data: any)  => api.put<any>(`/api/goals/${id}`, data),
  delete: (id: string)             => api.delete<any>(`/api/goals/${id}`),
}

export const expensesApi = {
  list:   () => api.get<any[]>('/api/expenses'),
  create: (data: any) => api.post<any>('/api/expenses', data),
  update: (id: string, data: any) => api.put<any>(`/api/expenses/${id}`, data),
  delete: (id: string) => api.delete<any>(`/api/expenses/${id}`),
}

export const dashboardApi = {
  stats: () => api.get<any>('/api/dashboard/stats'),
  sales: (period: string) =>
    api.get<any>(`/api/reports/sales?period=${period}`),
}

export interface InventoryInsights {
  reorder: { id: string; name: string; category: string; stock: number; threshold: number; velocity30d: number; suggestedQty: number }[]
  dormant: { id: string; name: string; category: string; stock: number; buyPrice: number; immobilizedValue: number; lastSale: string | null; daysSinceSale: number | null }[]
  dormantDays: number
  generatedAt: string
}

export interface VatReport {
  month: string
  vatRate: number
  posVatIncluded: boolean
  currency: string
  rows: { id: string; date: string; customerName: string | null; paymentMode: string; totalHT: number; tva: number; totalTTC: number }[]
  totals: { totalHT: number; tva: number; totalTTC: number; count: number }
}

export const reportsApi = {
  // Rapport comptable mensuel. month = 'YYYY-MM' (défaut backend = mois courant).
  accounting: (month?: string) =>
    api.get<AccountingReport>(`/api/reports/accounting${month ? `?month=${month}` : ''}`),
  // CSV détaillé vente par vente (téléchargement direct).
  accountingCsv: (month: string) =>
    downloadAuthedFile(`/api/reports/accounting/csv?month=${month}`, `comptabilite-${month}.csv`),
  // Rapport TVA (JSON).
  vat: (month: string) => api.get<VatReport>(`/api/reports/vat?month=${month}`),
  // Rapport TVA CSV (téléchargement direct).
  vatCsv: (month: string) =>
    downloadAuthedFile(`/api/reports/vat/csv?month=${month}`, `tva-${month}.csv`),
  // Rapport TVA PDF (téléchargement direct).
  vatPdf: (month: string) =>
    downloadAuthedFile(`/api/reports/vat/pdf?month=${month}`, `tva-${month}.pdf`),
  // Rapports actionnables : à réapprovisionner + produits dormants (tenant courant).
  inventory: () => api.get<InventoryInsights>('/api/reports/inventory'),
}

export interface AccountingReport {
  month: string
  currency: string
  revenue: { total: number; count: number }
  expenses: { total: number; byCategory: { category: string; amountTtc: number }[] }
  payroll: { total: number; projected: boolean }
  resultBeforePayroll: number        // revenue.total − expenses.total
  resultAfterPayrollEstimate: number // resultBeforePayroll − payroll.total (estimation)
  margin: number | null
  generatedAt: string
}

export const tenantApi = {
  get:        () => api.get<any>('/api/tenant'),
  update:     (data: any) => api.patch<any>('/api/tenant', data),
  setSlug:    (slug: string) => api.patch<any>('/api/tenant/slug', { slug }),
  users:      () => api.get<any[]>('/api/tenant/users'),
  createUser: (data: any) => api.post<any>('/api/tenant/users', data),
}

// Catalogue public — fetch direct sans JWT (n'utilise pas le wrapper api.ts qui ajoute le token).
export const publicApi = {
  catalog: async (slug: string): Promise<{ tenant: any; products: any[] } | null> => {
    const res = await fetch(`${BASE_URL}/api/public/catalog/${encodeURIComponent(slug)}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Erreur ${res.status}`)
    return res.json()
  },
}

export const usersApi = {
  list:         () => api.get<any[]>('/api/tenant/users'),
  invite:       (data: { name: string; email: string; role: string; password: string }) =>
                  api.post<any>('/api/tenant/users', data),
  update:       (id: string, data: { name?: string; email?: string; role?: string }) =>
                  api.put<any>(`/api/tenant/users/${id}`, data),
  toggleActive: (id: string, active: boolean) =>
                  api.patch<any>(`/api/tenant/users/${id}/active`, { active }),
  toggle2FA:    (id: string, twoFA: boolean) =>
                  api.patch<any>(`/api/tenant/users/${id}/2fa`, { twoFA }),
  delete:       (id: string) =>
                  api.delete<any>(`/api/tenant/users/${id}`),
}

export const aiApi = {
  analyze: (type: string, lang: string) =>
    api.post<any>('/api/ai/analyze', { type, lang }),
  // Envoie via messages[] pour compatibilité ancienne et nouvelle API
  chat: (message: string, lang: string) =>
    api.post<any>('/api/ai/chat', { messages: [{ role: 'user', content: message }], lang }),
  // Version historique complète (conversation multi-tours)
  chatHistory: (messages: Array<{role:string; content:string}>, lang: string) =>
    api.post<any>('/api/ai/chat', { messages, lang }),
}

export const whatsappApi = {
  sendTicket: (data: {
    phone:        string
    items:        { name: string; qty: number; price: number }[]
    total:        number
    paymentMode:  string
    discount?:    number
    reference?:   string
  }) => api.post<{ success: boolean; sid?: string }>('/api/whatsapp/send-ticket', data),
  broadcast:   (data: any) => api.post('/api/whatsapp/broadcast', data),
  testEvening: () => api.post('/api/whatsapp/test-evening', {}),
  testMorning: () => api.post('/api/whatsapp/test-morning', {}),
}

export interface Campaign {
  id: string
  message: string
  segment: string
  recipientCount: number
  sentCount: number
  failedCount: number
  createdAt: string
  user: { name: string }
}

export const marketingApi = {
  broadcast:  (data: any) => api.post('/api/whatsapp/broadcast', data),
  campaign:   (data: { message: string; segment: string }) => api.post<{ sent: number; failed: number; recipientCount: number }>('/api/marketing/whatsapp/campaign', data),
  campaigns:  () => api.get<Campaign[]>('/api/marketing/whatsapp/campaigns'),
}

export const loyaltyApi = {
  // Lecture seule : solde + palier + historique. Le créditage est 100% SERVEUR
  // (transaction de vente) — pas d'ajout déclenché par le front (route /add retirée).
  get: (id: string) => api.get<{ points: number; tier: string; history: any[]; bronzeDiscount?: number; silverDiscount?: number; goldDiscount?: number }>(`/api/customers/${id}/loyalty`),
  // Carte fidélité numérique (scope tenant strict, tout rôle).
  getCard: (id: string) => api.get<{
    customerId: string; customerName: string; tier: string; points: number;
    bronzeThreshold: number; silverThreshold: number; nextTier: string | null;
    pointsToNext: number; shopName: string; currency: string; enableLoyalty: boolean;
    // totalRevenue = base XOF (convertir à l'affichage) ; pointsPerAmount = devise tenant (PAS de conversion).
    totalRevenue?: number; pointsPerAmount?: number;
    bronzeDiscount?: number; silverDiscount?: number; goldDiscount?: number;
  }>(`/api/customers/${id}/loyalty-card`),
}

export const adminApi = {
  tenants:      () => api.get<any[]>('/api/admin/tenants'),
  stats:        () => api.get<any>('/api/admin/stats'),
  createTenant: (data: any) => api.post<any>('/api/admin/tenants', data),
  planRequests: () => api.get<any[]>('/api/admin/plan-requests'),
  reviewPlanRequest: (id: string, data: { action: 'approve' | 'reject'; adminNotes?: string }) =>
    api.patch<any>(`/api/admin/plan-requests/${id}`, data),
  securityEvents: (limit = 100) => api.get<any[]>(`/api/admin/security-events?limit=${limit}`),
}

export const accountApi = {
  securityActivity: () => api.get<any[]>('/api/account/security-activity'),
}

export const billingApi = {
  status:      () => api.get<any>('/api/billing/status'),
  requestPlan: (data: any) => api.post<any>('/api/billing/request-plan', data),
}

export const cronApi = {
  testEvening: () => api.post('/api/whatsapp/test-evening', {}),
  testMorning: () => api.post('/api/whatsapp/test-morning', {}),
}

/**
 * Alias de compatibilité (`Header.tsx`) — il DÉLÈGUE désormais au lieu de redéfinir.
 * ⚠️ Les deux entrées étaient recopiées à l'identique : deux définitions du même appel,
 * donc deux types à maintenir et la liberté de diverger en silence. Un alias qui recopie
 * n'est pas un alias.
 */
export const alertsApi = {
  lowStock: productsApi.lowStock,
  lookup: productsApi.lookup,
}

export const shiftsApi = {
  list:   (month?: string) => api.get<any[]>(`/api/shifts${month ? `?month=${month}` : ''}`),
  upsert: (data: { employeeId: string; date: string; shiftTypeKey: string; startTime?: string | null; endTime?: string | null; label?: string | null; color?: string | null }) =>
    api.post<any>('/api/shifts', data),
  update: (id: string, data: any) => api.patch<any>(`/api/shifts/${id}`, data),
  remove: (id: string) => api.delete<{ success: boolean }>(`/api/shifts/${id}`),
}

export const leaveRequestsApi = {
  list:    (status?: string) => api.get<any[]>(`/api/leave-requests${status ? `?status=${status}` : ''}`),
  create:  (data: { employeeId: string; startDate: string; endDate: string; leaveType?: string; reason?: string | null }) =>
    api.post<any>('/api/leave-requests', data),
  approve: (id: string) => api.post<any>(`/api/leave-requests/${id}/approve`, {}),
  refuse:  (id: string) => api.post<any>(`/api/leave-requests/${id}/refuse`, {}),
  update:  (id: string, data: any) => api.patch<any>(`/api/leave-requests/${id}`, data),
}

export const attendanceApi = {
  list:   (month?: string) => api.get<any[]>(`/api/attendance${month ? `?month=${month}` : ''}`),
  upsert: (data: { employeeId: string; date: string; status: string; arriveTime?: string | null; departTime?: string | null; note?: string | null }) =>
    api.post<any>('/api/attendance', data),
  update: (id: string, data: any) => api.patch<any>(`/api/attendance/${id}`, data),
  remove: (id: string) => api.delete<{ success: boolean }>(`/api/attendance/${id}`),
}

export const auditApi = {
  list: () => api.get<any[]>('/api/audit-logs'),
}

export const sentryStatusApi = {
  check: () => api.get<{ connected: boolean; projectName: string | null; errorRate: string; ms: number }>(
    '/api/integrations/sentry/status'
  ),
}
