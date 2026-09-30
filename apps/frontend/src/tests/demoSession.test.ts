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
