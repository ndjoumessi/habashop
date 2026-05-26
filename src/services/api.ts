import axios from 'axios'
import * as SecureStore from 'expo-secure-store'

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
  } catch {}
  return config
})

export const authApi = {
  login: (email:string, password:string) =>
    apiClient.post('/api/auth/login',{email,password}).then(r=>r.data),
  me: () => apiClient.get('/api/auth/me').then(r=>r.data),
}

export const productsApi = {
  list: (params?:any) =>
    apiClient.get('/api/products',{params}).then(r=>r.data),
  update: (id:string, data:any) =>
    apiClient.patch(`/api/products/${id}`,data).then(r=>r.data),
}

export const salesApi = {
  create: (data:any) =>
    apiClient.post('/api/sales',data).then(r=>r.data),
  list: (params?:any) =>
    apiClient.get('/api/sales',{params}).then(r=>r.data),
}

export const analyticsApi = {
  dashboard: () =>
    apiClient.get('/api/analytics/dashboard').then(r=>r.data),
}

export const customersApi = {
  list: () => apiClient.get('/api/customers').then(r=>r.data),
}
