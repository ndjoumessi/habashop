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
    'Content-Type': 'application/json',
    'Accept': 'application/json',
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
    api.post<{token:string; user:any}>('/api/auth/login', { email, password }),
  me: () => api.get<any>('/api/auth/me'),
  register: (data: any) => api.post<any>('/api/auth/register', data),
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
}

export const suppliersApi = {
  list:   () => api.get<any[]>('/api/suppliers'),
  create: (data: any) => api.post<any>('/api/suppliers', data),
  update: (id: string, data: any) => api.put<any>(`/api/suppliers/${id}`, data),
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

export const tenantApi = {
  get:    () => api.get<any>('/api/tenant'),
  update: (data: any) => api.put<any>('/api/tenant', data),
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
  sendTicket: (data: any) =>
    api.post('/api/whatsapp/send-ticket', data),
  broadcast: (data: any) =>
    api.post('/api/whatsapp/broadcast', data),
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
}

export const cronApi = {
  testEvening: () => api.post('/api/whatsapp/test-evening', {}),
  testMorning: () => api.post('/api/whatsapp/test-morning', {}),
}

// backward-compat alias (used by Header.tsx)
export const alertsApi = {
  lowStock: () => api.get<any[]>('/api/products/low-stock'),
}
