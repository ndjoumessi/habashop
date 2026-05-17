const BASE_URL: string = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3001'

function getToken(): string | null {
  const direct = localStorage.getItem('habashop_token')
  if (direct) return direct
  // Fallback : token dans le store Zustand persisté
  try {
    const stored = localStorage.getItem('habashop-auth')
    if (stored) {
      const parsed = JSON.parse(stored)
      const t = parsed?.state?.token
      if (t) return t
    }
  } catch {}
  return null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Erreur réseau' }))
    throw new Error(error.error ?? `HTTP ${res.status}`)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get:    <T>(path: string)                => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                => request<T>('DELETE', path),
}

export const authApi = {
  login:    (email: string, password: string) =>
    api.post<{ token: string; user: any }>('/api/auth/login', { email, password }),
  register: (data: any) =>
    api.post<{ token: string; user: any }>('/api/auth/register', data),
  me:       () => api.get<any>('/api/auth/me'),
}

export const productsApi = {
  list:   ()                          => api.get<any[]>('/api/products'),
  create: (data: any)                 => api.post<any>('/api/products', data),
  update: (id: string, data: any)     => api.put<any>(`/api/products/${id}`, data),
  delete: (id: string)                => api.delete(`/api/products/${id}`),
}

export const salesApi = {
  list:   ()         => api.get<any[]>('/api/sales'),
  create: (data: any) => api.post<any>('/api/sales', data),
}

export const customersApi = {
  list:   ()                      => api.get<any[]>('/api/customers'),
  create: (data: any)             => api.post<any>('/api/customers', data),
  update: (id: string, data: any) => api.put<any>(`/api/customers/${id}`, data),
}

export const suppliersApi = {
  list:   ()                      => api.get<any[]>('/api/suppliers'),
  create: (data: any)             => api.post<any>('/api/suppliers', data),
  update: (id: string, data: any) => api.put<any>(`/api/suppliers/${id}`, data),
}

export const ordersApi = {
  list:   ()         => api.get<any[]>('/api/orders'),
  create: (data: any) => api.post<any>('/api/orders', data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/api/orders/${id}/status`, { status }),
}

export const employeesApi = {
  list:   ()                      => api.get<any[]>('/api/employees'),
  create: (data: any)             => api.post<any>('/api/employees', data),
  update: (id: string, data: any) => api.put<any>(`/api/employees/${id}`, data),
}

export const expensesApi = {
  list:   ()                      => api.get<any[]>('/api/expenses'),
  create: (data: any)             => api.post<any>('/api/expenses', data),
  update: (id: string, data: any) => api.put<any>(`/api/expenses/${id}`, data),
  delete: (id: string)            => api.delete(`/api/expenses/${id}`),
}

export const dashboardApi = {
  stats: () => api.get<any>('/api/dashboard/stats'),
  sales: (period: string) => api.get<any>(`/api/reports/sales?period=${period}`),
}

export const alertsApi = {
  lowStock: () => api.get<any[]>('/api/products/low-stock'),
}

export const tenantApi = {
  get:    ()         => api.get<any>('/api/tenant'),
  update: (data:any) => api.put<any>('/api/tenant', data),
}

export const whatsappApi = {
  sendTicket: (data: {
    phone: string
    ticket: { ref: string; items: { name:string; qty:number; total:number }[]; total: number; paymentMode: string }
    shopName: string
    lang: string
  }) => api.post<any>('/api/whatsapp/send-ticket', data),

  sendAlert: (data: {
    phone: string
    alertType: string
    data: any
    lang: string
  }) => api.post<any>('/api/whatsapp/send-alert', data),
}

export const adminApi = {
  tenants:      ()         => api.get<any[]>('/api/admin/tenants'),
  stats:        ()         => api.get<any>('/api/admin/stats'),
  createTenant: (data:any) => api.post<any>('/api/admin/tenants', data),
}

export const aiApi = {
  analyze: (type: 'full' | 'stock' | 'revenue' | 'hr', lang: string) =>
    api.post<{ success: boolean; analysis: string; data: any }>('/api/ai/analyze', { type, lang }),
}

export const loyaltyApi = {
  get:    (customerId: string) => api.get<{ points: number; tier: string; history: any[] }>(`/api/customers/${customerId}/loyalty`),
  add:    (customerId: string, points: number, reason: string) =>
    api.post<{ points: number }>(`/api/customers/${customerId}/loyalty`, { points, reason }),
}

export const marketingApi = {
  broadcast: (data: { phones: string[]; message: string; lang: string }) =>
    api.post<{ sent: number; failed: number }>('/api/whatsapp/broadcast', data),
}

export const cronApi = {
  testEvening: () => api.post<{ success: boolean; message: string }>('/api/whatsapp/test-evening', {}),
  testMorning: () => api.post<{ success: boolean; message: string }>('/api/whatsapp/test-morning', {}),
}
