import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { useAppStore, whenAppStoreHydrated } from './appStore'
import { shouldApplyTenantCurrency } from '@/lib/prefs'
import { getStoredPushToken, clearStoredPushToken } from '@/services/notifications'
import type { User, Tenant } from '@/types'

interface AuthState {
  user: User | null; tenant: Tenant | null
  token: string | null; isLoading: boolean; isLoggedIn: boolean
  setAuth: (token: string, user: User, tenant: Tenant) => Promise<void>
  logout: () => Promise<void>
  restoreSession: () => Promise<void>
}

/**
 * Devise par défaut depuis le tenant : si l'utilisateur n'a jamais choisi de devise
 * manuellement (appStore.currencyManuallySet=false), aligne appStore.currency sur
 * tenant.currency. Sinon, respecte son choix (ne rien écraser).
 *
 * ⚠️ On ATTEND la réhydratation du persist avant de lire `currencyManuallySet` : sinon,
 * au démarrage/OTA, restoreSession (réseau) peut résoudre avant la lecture AsyncStorage et
 * lire l'état initial (false) → écraser le choix devise de l'utilisateur. (fix persistance)
 */
async function syncCurrencyFromTenant(tenant: Tenant | null | undefined): Promise<void> {
  await whenAppStoreHydrated()
  const app = useAppStore.getState()
  if (shouldApplyTenantCurrency(app.currencyManuallySet, tenant?.currency)) {
    app.setCurrency(tenant!.currency)
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null, tenant: null, token: null,
  isLoading: true, isLoggedIn: false,

  setAuth: async (token, user, tenant) => {
    await SecureStore.setItemAsync('auth_token', token)
    set({ token, user, tenant, isLoggedIn: true, isLoading: false })
    syncCurrencyFromTenant(tenant)
  },

  logout: async () => {
    // Désenregistrer le token push AVANT de vider l'auth (le DELETE nécessite un JWT valide).
    const pushToken = await getStoredPushToken()
    if (pushToken) {
      try {
        const { apiClient } = await import('../services/api')
        await apiClient.delete('/api/notifications/token', { data: { token: pushToken } })
      } catch {}
      await clearStoredPushToken()
    }
    await SecureStore.deleteItemAsync('auth_token')
    set({ user:null, tenant:null, token:null, isLoggedIn:false })
  },

  restoreSession: async () => {
    set({ isLoading: true })
    try {
      const token = await SecureStore.getItemAsync('auth_token')
      if (!token) { set({ isLoading: false }); return }
      const { apiClient } = await import('../services/api')
      apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
      // GET /api/auth/me renvoie un objet À PLAT { id, name, email, role, shopName, currency }
      // (et PAS { user, tenant }). On reconstruit donc `user` depuis ces champs et on récupère
      // le tenant complet via GET /api/tenant — sinon `tenant` restait undefined, ce qui
      // (1) cassait Settings (tenant.plan.toUpperCase()) et (2) déclenchait une boucle de
      // refetch /me infinie (le garde-fou Settings relançait restoreSession en boucle).
      const [meRes, tenantRes] = await Promise.all([
        apiClient.get('/api/auth/me'),
        apiClient.get('/api/tenant').catch(() => null),
      ])
      const me = meRes.data
      const tenant: Tenant = tenantRes?.data ?? {
        id: '', name: me?.shopName ?? 'HabaShop', plan: '',
        currency: me?.currency ?? 'XOF', lang: 'fr', status: 'active',
      }
      const user: User = {
        id: me.id, name: me.name, email: me.email,
        role: me.role, tenantId: tenant.id,
      }
      set({ token, user, tenant, isLoggedIn: true, isLoading: false })
      syncCurrencyFromTenant(tenant)
    } catch (err: any) {
      // Ne purger le token que si le serveur l'a explicitement rejeté (401/403).
      // Timeout / hors-ligne / cold-start Railway → on garde le token pour la
      // prochaine ouverture, sinon déconnexion forcée à chaque réseau lent.
      const status = err?.response?.status
      if (status === 401 || status === 403) {
        await SecureStore.deleteItemAsync('auth_token')
      }
      set({ isLoading: false })
    }
  },
}))
