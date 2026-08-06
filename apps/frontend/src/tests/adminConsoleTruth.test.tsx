import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

/**
 * VERROU — la console Ops ne doit pas dire vrai « à vide ».
 *
 * ─── LA VÉRITÉ VACANTE ───────────────────────────────────────────────────────
 * L'écran affichait une coche verte « Toutes vos boutiques ont démarré » avec
 * « 0 inscrites ». Sur l'ensemble VIDE, « toutes » est vrai et ne veut rien dire : la
 * console félicitait pour un succès que personne n'avait obtenu.
 *
 * C'est une FAMILLE, pas une ligne — `.every()` rend `true` et `.some()` rend `false` sur
 * un tableau vide, les deux mentent quand la liste est vide. On exige donc TROIS états :
 *
 *   aucune inscrite       → état vide, NEUTRE, sans coche ni couleur de succès
 *   inscrites, en retard  → alerte
 *   inscrites, toutes ok  → succès
 *
 * ⚠️ Ce fichier monte le VRAI `AdminDashboard` : un test qui grep la source resterait vert
 * si le bloc devenait inatteignable et rougirait sur un reformatage.
 */

const { mockState, authState } = vi.hoisted(() => ({
  mockState: { lang: 'fr', currency: 'XOF' },
  authState: { user: { id: 'u', role: 'ADMIN', isPlatformAdmin: true }, tenants: [], activeTenantId: null },
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/components/integrations/OpsInfrastructure', () => ({ default: () => <div /> }))
vi.mock('@/components/admin/SecurityEvents', () => ({ default: () => <div /> }))
vi.mock('@/stores/authStore', () => {
  const useAuthStore: any = vi.fn(() => authState)
  useAuthStore.getState = () => authState
  return { useAuthStore }
})
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as any
  const useAppStore: any = vi.fn((sel?: any) => sel ? sel(mockState) : mockState)
  useAppStore.getState = () => mockState
  return { ...actual, useAppStore }
})

const adminApi = vi.hoisted(() => ({
  stats: vi.fn(), tenants: vi.fn(), planRequests: vi.fn(),
  approveRequest: vi.fn(), rejectRequest: vi.fn(), createTenant: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ adminApi, authApi: { changePassword: vi.fn() } }))

import AdminDashboard from '@/pages/AdminDashboard'

const STATS = (o: Partial<Record<string, unknown>> = {}) => ({
  totalTenants: 0, totalUsers: 0, totalSales: 0, totalRevenue: 0, totalProducts: 0,
  fixtureTenants: 3, mrrXof: 0, mrrParPlan: [], ...o,
})
const T = (id: string, o: Record<string, unknown> = {}) => ({
  id, name: `Boutique ${id}`, plan: 'starter', status: 'active', currency: 'XOF', country: 'CM',
  createdAt: '2026-07-01T00:00:00Z', isFixture: false, revenue: 0, lastActivityAt: null,
  _count: { users: 1, products: 3, sales: 2 }, ...o,
})

const monter = async (stats: object, tenants: object[]) => {
  adminApi.stats.mockResolvedValue(stats)
  adminApi.tenants.mockResolvedValue(tenants)
  adminApi.planRequests.mockResolvedValue([])
  const r = render(<AdminDashboard />)
  await waitFor(() => expect(adminApi.tenants).toHaveBeenCalled())
  return r
}

beforeEach(() => vi.clearAllMocks())

describe('① les TROIS états de l’activation', () => {
  it('AUCUNE inscrite → état vide NEUTRE, ni coche ni « toutes »', async () => {
    const { container } = await monter(STATS(), [
      T('demo-tenant-001', { isFixture: true }), T('e2e-tenant', { isFixture: true }),
    ])
    await waitFor(() => expect(screen.getByText(/Aucune boutique cliente/)).toBeInTheDocument())
    // ⚠️ LE DÉFAUT D'ORIGINE : « toutes » sur l'ensemble vide.
    expect(container.textContent).not.toMatch(/Toutes vos boutiques ont démarré/)
    expect(container.textContent).toMatch(/Rien à mesurer/)
  })

  it('inscrites AVEC retard → alerte, pas de félicitations', async () => {
    const { container } = await monter(STATS({ totalTenants: 2 }), [
      T('c1', { _count: { users: 1, products: 0, sales: 0 } }),
      T('c2', { _count: { users: 1, products: 5, sales: 3 } }),
    ])
    await waitFor(() => expect(container.textContent).toMatch(/sans aucun produit enregistré/))
    expect(container.textContent).not.toMatch(/Toutes vos boutiques ont démarré/)
    expect(container.textContent).not.toMatch(/Aucune boutique cliente/)
  })

  it('inscrites et TOUTES démarrées → succès — le seul cas où « toutes » est vrai ET plein', async () => {
    const { container } = await monter(STATS({ totalTenants: 2 }), [
      T('c1', { _count: { users: 1, products: 5, sales: 3 } }),
      T('c2', { _count: { users: 1, products: 2, sales: 1 } }),
    ])
    await waitFor(() => expect(container.textContent).toMatch(/Toutes vos boutiques ont démarré/))
    expect(container.textContent).not.toMatch(/Aucune boutique cliente/)
  })
})

describe('② les deux nombres sont lisibles ENSEMBLE', () => {
  it('l’onglet porte « clientes · total » quand ils diffèrent', async () => {
    await monter(STATS({ totalTenants: 0 }), [
      T('demo-tenant-001', { isFixture: true }),
      T('demo-tenant-002', { isFixture: true }),
      T('e2e-tenant', { isFixture: true }),
    ])
    const onglet = await screen.findByRole('tab', { name: /Boutiques/ })
    // ⚠️ Avant : l'onglet disait « 0 » pendant que la liste montrait trois cartes.
    expect(onglet.textContent).toMatch(/0\s*·\s*3/)
    expect(onglet.getAttribute('title')).toMatch(/cliente/i)
  })

  it('un seul nombre quand ils coïncident — pas de bruit inutile', async () => {
    await monter(STATS({ totalTenants: 2 }), [T('c1'), T('c2')])
    const onglet = await screen.findByRole('tab', { name: /Boutiques/ })
    expect(onglet.textContent).not.toMatch(/·/)
  })
})

describe('② bis — les fixtures sont MARQUÉES sur la carte, pas dans une phrase ailleurs', () => {
  it('chaque fixture porte un badge visible dans la liste', async () => {
    const { container } = await monter(STATS(), [
      T('demo-tenant-001', { isFixture: true }), T('c1'),
    ])
    // On bascule sur l'onglet Boutiques.
    const onglet = await screen.findByRole('tab', { name: /Boutiques/ })
    onglet.click()
    await waitFor(() => expect(container.textContent).toMatch(/démo \/ test/i))
    const badges = [...container.querySelectorAll('span')].filter(e => /^démo \/ test$/i.test(e.textContent ?? ''))
    // Une seule des deux boutiques est une fixture.
    expect(badges).toHaveLength(1)
  })
})

describe('③ la file « à traiter » applique le MÊME prédicat que les agrégats', () => {
  it('une fixture n’y entre JAMAIS, même si elle coche un motif', async () => {
    const vieux = new Date(Date.now() - 40 * 86400000).toISOString()
    const { container } = await monter(STATS(), [
      // La démo est « sans vente depuis 40 j » : elle cocherait le motif si on l'incluait.
      T('demo-tenant-001', { isFixture: true, name: 'Démo Dakar', lastActivityAt: vieux }),
    ])
    await waitFor(() => expect(adminApi.tenants).toHaveBeenCalled())
    expect(container.textContent).not.toMatch(/Démo Dakar/)
    // …et l'état vide DIT pourquoi, au lieu de se lire comme un succès.
    expect(container.textContent).toMatch(/Rien à traiter : cette file se remplira/i)
  })
})
