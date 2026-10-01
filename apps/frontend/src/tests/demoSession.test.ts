import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api', () => ({
  demoApi: { start: vi.fn() },
  authApi: { login: vi.fn(), register: vi.fn(), switchTenant: vi.fn(), me: vi.fn() },
  tenantApi: { get: vi.fn() },
}))

import { useAuthStore } from '@/stores/authStore'
import { isDemoSession, markDemoSession, clearDemoSession } from '@/lib/demoSession'
import { demoApi } from '@/lib/api'

const REPONSE = {
  token: 'JETON-DEMO',
  user: {
    id: 'u1', name: 'Visiteur démo', email: 'demo-x@demo.local', role: 'ADMIN',
    shopName: 'Boutique de démonstration', isPlatformAdmin: false,
  },
  tenant: {
    id: 'demo-tmp-1', name: 'Boutique de démonstration', currency: 'XOF', plan: 'starter',
    logo: null, address: null, demoExpiresAt: '2026-10-08T12:00:00.000Z',
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useAuthStore.getState().logout()
  vi.mocked(demoApi.start).mockResolvedValue(REPONSE as never)
})

describe('marquage de session de démonstration', () => {
  it('⚠️ une session NORMALE n’est pas marquée comme démo', () => {
    expect(isDemoSession()).toBe(false)
  })

  it('le marquage se pose et se retire', () => {
    markDemoSession()
    expect(isDemoSession()).toBe(true)
    clearDemoSession()
    expect(isDemoSession()).toBe(false)
  })

  it('⚠️ un stockage indisponible ne fait pas lever — il rend simplement « pas une démo »', () => {
    const espion = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqué') })
    expect(() => isDemoSession()).not.toThrow()
    expect(isDemoSession()).toBe(false)
    espion.mockRestore()
  })
})

describe('startDemo', () => {
  it('ouvre une session authentifiée et stocke le jeton', async () => {
    await useAuthStore.getState().startDemo()
    expect(localStorage.getItem('habashop_token')).toBe('JETON-DEMO')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('marque la session comme DÉMO — c’est ce drapeau qui évite /login au 401', async () => {
    await useAuthStore.getState().startDemo()
    expect(isDemoSession()).toBe(true)
  })

  it('logout efface le marquage de démo', async () => {
    await useAuthStore.getState().startDemo()
    useAuthStore.getState().logout()
    expect(isDemoSession()).toBe(false)
  })

  it('⚠️ un rôle inconnu retombe sur le MOINS privilégié, jamais sur un rôle deviné', async () => {
    vi.mocked(demoApi.start).mockResolvedValue({ ...REPONSE, user: { ...REPONSE.user, role: 'SORCIER' } } as never)
    await useAuthStore.getState().startDemo()
    expect(useAuthStore.getState().user?.role).toBe('CASHIER')
  })

  it('l’échéance SERVEUR est conservée telle quelle — jamais recalculée côté client', async () => {
    await useAuthStore.getState().startDemo()
    const { useAppStore } = await import('@/stores/appStore')
    const t = useAppStore.getState().tenant as { demoExpiresAt?: string } | null
    expect(t?.demoExpiresAt).toBe('2026-10-08T12:00:00.000Z')
  })

  it('la boutique devient la boutique active', async () => {
    await useAuthStore.getState().startDemo()
    expect(useAuthStore.getState().activeTenantId).toBe('demo-tmp-1')
    expect(useAuthStore.getState().tenants).toHaveLength(1)
  })

  it('⚠️ une erreur réseau ne laisse PAS une session à moitié ouverte', async () => {
    vi.mocked(demoApi.start).mockRejectedValue(new Error('réseau'))
    await expect(useAuthStore.getState().startDemo()).rejects.toThrow()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(localStorage.getItem('habashop_token')).toBeNull()
    expect(isDemoSession()).toBe(false)
  })
})

/**
 * ⚠️ LE MARQUAGE NE DOIT PAS SURVIVRE À UNE VRAIE SESSION.
 *
 * Défaut trouvé en revue, et c'est le parcours de conversion VISÉ par la fonctionnalité : un
 * visiteur ouvre la démo, l'essaie, revient sur la vitrine, clique « Créer ma boutique » et
 * s'inscrit. Le marquage restait posé. Sept jours plus tard son jeton expire, et le premier
 * appel API l'envoyait sur la vitrine avec « Votre démonstration a expiré » — alors qu'il est
 * un commerçant réel qui paie et que sa boutique est intacte. Le logiciel lui disait le
 * contraire et l'envoyait au mauvais endroit.
 */
describe('le marquage de démo ne survit pas à une vraie session', () => {
  it('⚠️ `register` efface le marquage — c’est le parcours de conversion', async () => {
    await useAuthStore.getState().startDemo()
    expect(isDemoSession()).toBe(true)
    const { authApi } = await import('@/lib/api')
    vi.mocked(authApi.register).mockResolvedValue(REPONSE as never)
    await useAuthStore.getState().register({ email: 'vrai@commercant.com', password: 'motdepasse' })
    expect(isDemoSession(), 'un commerçant inscrit n’est pas en démonstration').toBe(false)
  })

  it('⚠️ `login` efface le marquage — même navigateur, session suivante', async () => {
    await useAuthStore.getState().startDemo()
    const { authApi } = await import('@/lib/api')
    vi.mocked(authApi.login).mockResolvedValue({ ...REPONSE, tenants: [], activeTenantId: null } as never)
    await useAuthStore.getState().login('vrai@commercant.com', 'motdepasse')
    expect(isDemoSession()).toBe(false)
  })
})

/**
 * ⚠️ UNE SESSION NEUVE NE PART PAS AVEC LE PANIER DE LA PRÉCÉDENTE.
 *
 * Défaut trouvé en revue : `login` appelait `resetCashierSession()` puis `clearCart()`,
 * `adoptSession` non — alors qu'elle sert `register` ET `startDemo`. Un caissier avec trois
 * articles au panier qui clique « Essayer la démo » emportait des `productId` du tenant A
 * dans le tenant B : la confirmation de vente partait avec ces identifiants et le serveur
 * refusait en 400 `UNKNOWN_PRODUCT`. Le visiteur voyait un produit cassé.
 */
describe('hygiène de session', () => {
  it('⚠️ `startDemo` vide le panier hérité', async () => {
    const { useAppStore } = await import('@/stores/appStore')
    useAppStore.setState({ cart: [{ id: 'p-tenant-A', qty: 3 }] } as never)
    await useAuthStore.getState().startDemo()
    expect(useAppStore.getState().cart, 'le panier du tenant précédent ne doit pas entrer dans la démo').toEqual([])
  })

  it('⚠️ `register` aussi — la fabrique est la même', async () => {
    const { useAppStore } = await import('@/stores/appStore')
    useAppStore.setState({ cart: [{ id: 'p-x', qty: 1 }] } as never)
    const { authApi } = await import('@/lib/api')
    vi.mocked(authApi.register).mockResolvedValue(REPONSE as never)
    await useAuthStore.getState().register({ email: 'a@b.c', password: 'motdepasse' })
    expect(useAppStore.getState().cart).toEqual([])
  })
})

describe('adoptSession partagée par register et startDemo', () => {
  it('⚠️ les DEUX chemins normalisent le rôle — un seul sabotage doit faire tomber les deux', async () => {
    // startDemo
    vi.mocked(demoApi.start).mockResolvedValue({ ...REPONSE, user: { ...REPONSE.user, role: 'INCONNU' } } as never)
    await useAuthStore.getState().startDemo()
    expect(useAuthStore.getState().user?.role).toBe('CASHIER')

    // register — même fabrique de session
    useAuthStore.getState().logout()
    const { authApi } = await import('@/lib/api')
    vi.mocked(authApi.register).mockResolvedValue({ ...REPONSE, user: { ...REPONSE.user, role: 'INCONNU' } } as never)
    await useAuthStore.getState().register({ email: 'a@b.c', password: 'motdepasse' })
    expect(useAuthStore.getState().user?.role).toBe('CASHIER')
  })
})
