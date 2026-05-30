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
      if (token && token !== 'null' && token !== 'undefined' && token !== 'demo-token-local') {
        return token
      }
    } catch {}
  }
  return null
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
  console.log(`API ${method} ${path} | token: ${token ? '✅' : '❌'}`)

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
      throw new Error(errMsg)
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
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{token:string; user:any; tenant?:any}>('/api/auth/login', { email, password }),
  me: () => api.get<any>('/api/auth/me'),
  register: (data: any) => api.post<{token:string; user:any; tenant?:any}>('/api/auth/register', data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<{ success: boolean; message: string }>('/api/auth/password', { currentPassword, newPassword }),
}

export const productsApi = {
  list:     () => api.get<any[]>('/api/products'),
  create:   (data: any) => api.post<any>('/api/products', data),
  update:   (id: string, data: any) => api.put<any>(`/api/products/${id}`, data),
  delete:   (id: string) => api.delete<any>(`/api/products/${id}`),
  lowStock: () => api.get<any[]>('/api/products/low-stock'),
}

export const salesApi = {
  list:   () => api.get<any[]>('/api/sales'),
  create: (data: any) => api.post<any>('/api/sales', data),
}

export const customersApi = {
  list:   () => api.get<any[]>('/api/customers'),
  create: (data: any) => api.post<any>('/api/customers', data),
  update: (id: string, data: any) => api.put<any>(`/api/customers/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/customers/${id}`),
}

export const suppliersApi = {
  list:   () => api.get<any[]>('/api/suppliers'),
  create: (data: any) => api.post<any>('/api/suppliers', data),
  update: (id: string, data: any) => api.put<any>(`/api/suppliers/${id}`, data),
  delete: (id: string) => api.delete<void>(`/api/suppliers/${id}`),
}

export const ordersApi = {
  list:         () => api.get<any[]>('/api/orders'),
  create:       (data: any) => api.post<any>('/api/orders', data),
  updateStatus: (id: string, status: string) =>
    api.patch<any>(`/api/orders/${id}/status`, { status }),
}

export const employeesApi = {
  list:   () => api.get<any[]>('/api/employees'),
  create: (data: any) => api.post<any>('/api/employees', data),
  update: (id: string, data: any) => api.put<any>(`/api/employees/${id}`, data),
  delete: (id: string) => api.delete<any>(`/api/employees/${id}`),
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

export const reportsApi = {
  // Rapport comptable mensuel. month = 'YYYY-MM' (défaut backend = mois courant).
  accounting: (month?: string) =>
    api.get<AccountingReport>(`/api/reports/accounting${month ? `?month=${month}` : ''}`),
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

export const marketingApi = {
  broadcast: (data: any) => api.post('/api/whatsapp/broadcast', data),
}

export const loyaltyApi = {
  get:       (id: string) => api.get<any>(`/api/customers/${id}/loyalty`),
  addPoints: (id: string, saleTotal: number) =>
    api.post(`/api/customers/${id}/loyalty/add`, { saleTotal }),
}

export const adminApi = {
  tenants:      () => api.get<any[]>('/api/admin/tenants'),
  stats:        () => api.get<any>('/api/admin/stats'),
  createTenant: (data: any) => api.post<any>('/api/admin/tenants', data),
  planRequests: () => api.get<any[]>('/api/admin/plan-requests'),
  reviewPlanRequest: (id: string, data: { action: 'approve' | 'reject'; adminNotes?: string }) =>
    api.patch<any>(`/api/admin/plan-requests/${id}`, data),
}

export const billingApi = {
  status:      () => api.get<any>('/api/billing/status'),
  requestPlan: (data: any) => api.post<any>('/api/billing/request-plan', data),
}

export const cronApi = {
  testEvening: () => api.post('/api/whatsapp/test-evening', {}),
  testMorning: () => api.post('/api/whatsapp/test-morning', {}),
}

// backward-compat alias (used by Header.tsx)
export const alertsApi = {
  lowStock: () => api.get<any[]>('/api/products/low-stock'),
}

export const auditApi = {
  list: () => api.get<any[]>('/api/audit-logs'),
}
