import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const http = axios.create({ baseURL: BASE })

http.interceptors.request.use((config) => {
  const raw = localStorage.getItem('habashop-auth')
  if (raw) {
    try {
      const { state } = JSON.parse(raw)
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`
    } catch {}
  }
  return config
})

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('habashop-auth')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string, tenantSlug: string) =>
    http.post('/api/auth/login', { email, password, tenantSlug }).then(r => r.data),
  refresh: (refreshToken: string) =>
    http.post('/api/auth/refresh', { refreshToken }).then(r => r.data),
}

// ── Products ─────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (params?: { search?: string; category?: string; lowStock?: boolean }) =>
    http.get('/api/products', { params }).then(r => r.data),
  get: (id: string) => http.get(`/api/products/${id}`).then(r => r.data),
  create: (data: any) => http.post('/api/products', data).then(r => r.data),
  update: (id: string, data: any) => http.put(`/api/products/${id}`, data).then(r => r.data),
  remove: (id: string) => http.delete(`/api/products/${id}`),
  search: (q: string) => http.get('/api/products/search', { params: { q } }).then(r => r.data),
}

// ── Suppliers ─────────────────────────────────────────────────────────────────
export const suppliersApi = {
  list: (params?: { search?: string; country?: string }) =>
    http.get('/api/suppliers', { params }).then(r => r.data),
  get: (id: string) => http.get(`/api/suppliers/${id}`).then(r => r.data),
  create: (data: any) => http.post('/api/suppliers', data).then(r => r.data),
  update: (id: string, data: any) => http.put(`/api/suppliers/${id}`, data).then(r => r.data),
  remove: (id: string) => http.delete(`/api/suppliers/${id}`),
}

// ── Customers ─────────────────────────────────────────────────────────────────
export const customersApi = {
  list: (params?: { search?: string; type?: string }) =>
    http.get('/api/customers', { params }).then(r => r.data),
  get: (id: string) => http.get(`/api/customers/${id}`).then(r => r.data),
  create: (data: any) => http.post('/api/customers', data).then(r => r.data),
  update: (id: string, data: any) => http.put(`/api/customers/${id}`, data).then(r => r.data),
  remove: (id: string) => http.delete(`/api/customers/${id}`),
}

// ── Orders ───────────────────────────────────────────────────────────────────
export const ordersApi = {
  list: (params?: { status?: string; supplierId?: string }) =>
    http.get('/api/orders', { params }).then(r => r.data),
  get: (id: string) => http.get(`/api/orders/${id}`).then(r => r.data),
  create: (data: any) => http.post('/api/orders', data).then(r => r.data),
  updateStatus: (id: string, status: string) =>
    http.put(`/api/orders/${id}/status`, { status }).then(r => r.data),
  receive: (id: string) => http.post(`/api/orders/${id}/receive`).then(r => r.data),
}

// ── Sales ────────────────────────────────────────────────────────────────────
export const salesApi = {
  list: (params?: { from?: string; to?: string; page?: number }) =>
    http.get('/api/sales', { params }).then(r => r.data),
  get: (id: string) => http.get(`/api/sales/${id}`).then(r => r.data),
  create: (data: any) => http.post('/api/sales', data).then(r => r.data),
}

// ── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  summary: (period: string) => http.get('/api/reports/summary', { params: { period } }).then(r => r.data),
  topProducts: (period: string, limit = 10) =>
    http.get('/api/reports/top-products', { params: { period, limit } }).then(r => r.data),
  byCategory: (period: string) => http.get('/api/reports/by-category', { params: { period } }).then(r => r.data),
  paymentMethods: (period: string) => http.get('/api/reports/payment-methods', { params: { period } }).then(r => r.data),
  salesTrend: (period: string) => http.get('/api/reports/sales-trend', { params: { period } }).then(r => r.data),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  kpis: () => http.get('/api/dashboard/kpis').then(r => r.data),
  recentActivity: () => http.get('/api/dashboard/recent-activity').then(r => r.data),
  salesChart: () => http.get('/api/dashboard/sales-chart').then(r => r.data),
}
