import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { useAppStore, whenAppStoreHydrated } from './appStore'
import { shouldApplyTenantCurrency } from '@/lib/prefs'
import { getStoredPushToken, clearStoredPushToken } from '@/services/notifications'
import { apiClient } from '@/services/api'
import { estSessionExpiree } from '@/lib/sessionExpiree'
import type { User, Tenant } from '@/types'

interface AuthState {
  user: User | null; tenant: Tenant | null
  token: string | null; isLoading: boolean; isLoggedIn: boolean
  /** Le serveur a rejeté le jeton EN COURS DE SESSION → l'écran de connexion le dit. */
  sessionExpired: boolean
  setAuth: (token: string, user: User, tenant: Tenant) => Promise<void>
  logout: () => Promise<void>
  expireSession: () => Promise<void>
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
  isLoading: true, isLoggedIn: false, sessionExpired: false,

  setAuth: async (token, user, tenant) => {
    await SecureStore.setItemAsync('auth_token', token)
    // Une reconnexion réussie efface le bandeau : sinon il resterait pour toujours.
    set({ token, user, tenant, isLoggedIn: true, isLoading: false, sessionExpired: false })
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
    // Déconnexion VOULUE : pas de bandeau « session expirée », rien n'a expiré.
    set({ user:null, tenant:null, token:null, isLoggedIn:false, sessionExpired:false })
  },

  /**
   * Le serveur a rejeté le JETON pendant que l'application tournait (cf.
   * `lib/sessionExpiree.ts`). On purge et on l'ANNONCE — un écran muet laisserait le
   * commerçant devant des erreurs réseau qu'aucun réessai ne peut résoudre.
   *
   * ⚠️ Idempotente : une page qui charge quatre requêtes en parallèle produit quatre
   * 401 d'un coup. Sans cette garde, on repurgerait et on écraserait l'état quatre fois.
   * On NE désenregistre PAS le jeton push ici (contrairement à `logout`) : l'appel
   * exigerait le jeton qu'on vient de constater mort, et rendrait un nouveau 401.
   */
  expireSession: async () => {
    if (useAuthStore.getState().sessionExpired) return
    await SecureStore.deleteItemAsync('auth_token')
    set({ user:null, tenant:null, token:null, isLoggedIn:false, isLoading:false, sessionExpired:true })
  },

  // (l'intercepteur qui l'appelle est installé en bas de ce fichier)

  restoreSession: async () => {
    set({ isLoading: true })
    try {
      let token = await SecureStore.getItemAsync('auth_token')
      if (!token) { set({ isLoading: false }); return }
      const { apiClient, authApi } = await import('../services/api')
      apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
      // GET /api/auth/me renvoie un objet À PLAT { id, name, email, role, shopName, currency }
      // (et PAS { user, tenant }). On reconstruit donc `user` depuis ces champs et on récupère
      // le tenant complet via GET /api/tenant — sinon `tenant` restait undefined, ce qui
      // (1) cassait Settings (tenant.plan.toUpperCase()) et (2) déclenchait une boucle de
      // refetch /me infinie (le garde-fou Settings relançait restoreSession en boucle).
      const [meRes, tenantResult] = await Promise.all([
        apiClient.get('/api/auth/me'),
        apiClient.get('/api/tenant')
          .then((r) => ({ ok: true as const, data: r.data }))
          .catch((e: any) => ({ ok: false as const, err: e })),
      ])
      let tenantData: Tenant | null = tenantResult.ok ? tenantResult.data : null
      // Multi-boutiques v2 : un token déjà stocké SANS boutique active → /api/tenant renvoie
      // 400 NO_ACTIVE_TENANT. On auto-sélectionne la 1ʳᵉ boutique et on remplace le token
      // (débloque un compte multi-boutique déjà connecté via OTA, sans re-login).
      // Comptes mono-boutique : /api/tenant renvoie 200 → cette branche ne s'exécute jamais.
      if (!tenantResult.ok && (tenantResult.err?.response?.data?.code === 'NO_ACTIVE_TENANT')) {
        const list = await authApi.tenants().catch(() => [] as { id: string }[])
        if (list.length >= 1) {
          const sw = await authApi.switchTenant(list[0].id, token)
          token = sw.token
          await SecureStore.setItemAsync('auth_token', token)
          apiClient.defaults.headers.common.Authorization = `Bearer ${token}`
          tenantData = sw.tenant
        }
      }
      const me = meRes.data
      const tenant: Tenant = tenantData ?? {
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

/**
 * UN JETON REJETÉ EN COURS DE SESSION DÉCONNECTE — il n'affiche pas « réessayer ».
 *
 * `restoreSession` ne traite le 401 qu'au DÉMARRAGE. Un jeton qui meurt pendant que
 * l'application tourne n'était traité NULLE PART (mesuré le 2026-10-02) : le commerçant
 * restait visuellement connecté devant des écrans en erreur réseau, et seul un
 * redémarrage de l'application le sortait de là.
 *
 * ⚠️ POSÉ ICI, PAS DANS `services/api.ts` : le sens de l'import est une contrainte, pas
 * un goût. `api → authStore` boucle (`authStore → notifications → api`) ; `authStore →
 * api` est acyclique. Et l'import dynamique qui aurait contourné le cycle N'EST PAS
 * TESTABLE — jest le refuse sans `--experimental-vm-modules`, si bien que le garde
 * aurait été silencieusement mort sous un test vert.
 *
 * ⚠️ L'erreur est RE-REJETÉE : l'appelant garde son traitement (toast, bascule hors
 * ligne, écran d'erreur). On ajoute une conséquence, on n'en retire aucune.
 *
 * La règle de décision vit dans `lib/sessionExpiree.ts` : elle exige un code POSITIF
 * émis par les gardes de jeton, pour ne pas confondre un jeton mort avec un mot de
 * passe mal tapé (trois routes rendent 401 pour ça).
 */
apiClient.interceptors.response.use(undefined, async (err: unknown) => {
  if (estSessionExpiree(err)) await useAuthStore.getState().expireSession()
  return Promise.reject(err)
})
