import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

/**
 * VERROU — la table des boutiques doit tenir à L'ÉCHELLE, pas sur le jeu de démonstration.
 *
 * ─── POURQUOI 50 LIGNES ET PAS 4 ─────────────────────────────────────────────
 * La galerie de cartes qu'on remplace « marchait » : elle marchait à 3 boutiques. C'est le
 * cas à 50 qui a motivé le chantier, et un test à 4 lignes ne le prouve pas — il reproduit
 * exactement la situation qui a laissé passer le défaut. Toutes les assertions de ce fichier
 * portent donc sur un jeu LARGE, et le nombre de lignes est vérifié pour qu'un `slice`
 * silencieux ne puisse pas rendre le test vert sur un sous-ensemble.
 *
 * ─── CE QUI EST GARDÉ ────────────────────────────────────────────────────────
 *  · une ligne par boutique, toutes rendues (pas de troncature muette) ;
 *  · le MRR est une COLONNE — il ne vivait que dans le tiroir ;
 *  · une fixture est présente, badgée, et son MRR vaut « — » (jamais un montant) ;
 *  · les fixtures n'entrent dans aucun total ;
 *  · les colonnes chiffrées sont alignées à droite en chiffres tabulaires.
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
  const useAuthStore: (() => typeof authState) & { getState: () => typeof authState } =
    Object.assign(vi.fn(() => authState), { getState: () => authState })
  return { useAuthStore }
})
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  const useAppStore = Object.assign(
    vi.fn((sel?: (s: typeof mockState) => unknown) => (sel ? sel(mockState) : mockState)),
    { getState: () => mockState },
  )
  return { ...actual, useAppStore }
})

const adminApi = vi.hoisted(() => ({
  stats: vi.fn(), tenants: vi.fn(), planRequests: vi.fn(),
  approveRequest: vi.fn(), rejectRequest: vi.fn(), createTenant: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ adminApi, authApi: { changePassword: vi.fn() } }))

import AdminDashboard from '@/pages/AdminDashboard'

/**
 * ⚠️ JEU LARGE — 50 clientes + 3 fixtures.
 * Les noms sont GÉNÉRÉS (« Boutique 01 »…), jamais empruntés à une maquette ni à la
 * production : un nom de boutique inventé qui ressemble à un vrai finit par être lu comme
 * une donnée (§ Neutraliser les exemples).
 */
const CLIENTES = 50
const FIXTURES = 3

const tenant = (id: string, n: number, o: Record<string, unknown> = {}) => ({
  id, name: `Boutique ${String(n).padStart(2, '0')}`,
  plan: ['starter', 'business', 'enterprise'][n % 3], status: 'active',
  currency: 'XOF', country: 'CM',
  createdAt: new Date(2026, 0, 1 + (n % 28)).toISOString(),
  // ⚠️ Une boutique sur cinq porte un CA à NEUF chiffres — la valeur PLAUSIBLE qui a
  // fait passer la colonne à la ligne, pas la plus grande valeur actuelle.
  isFixture: false, revenue: n % 5 === 0 ? 987_654_321 : n * 1000,
  lastActivityAt: new Date(2026, 6, 1 + (n % 20)).toISOString(),
  _count: { users: n % 7, products: n * 2, sales: n * 3 },
  ...o,
})

const JEU = [
  ...Array.from({ length: CLIENTES }, (_, k) => tenant(`c${k}`, k + 1)),
  tenant('demo-tenant-001', 90, { isFixture: true }),
  tenant('demo-tenant-002', 91, { isFixture: true }),
  tenant('e2e-tenant', 92, { isFixture: true }),
]

beforeEach(() => {
  vi.clearAllMocks()
  adminApi.stats.mockResolvedValue({
    totalTenants: CLIENTES, totalUsers: 120, totalSales: 900, totalRevenue: 5_000_000,
    totalProducts: 400, fixtureTenants: FIXTURES, mrrXof: 400_000,
    mrrParPlan: [{ plan: 'starter', tenants: 30, mrrXof: 240_000, surDevis: false }],
  })
  adminApi.tenants.mockResolvedValue(JEU)
  adminApi.planRequests.mockResolvedValue([])
})

async function ouvrirOnglet() {
  const r = render(<AdminDashboard />)
  await waitFor(() => expect(adminApi.tenants).toHaveBeenCalled())
  const onglet = await screen.findByRole('tab', { name: /Boutiques/ })
  onglet.click()
  await waitFor(() => expect(r.container.querySelector('table')).toBeTruthy())
  return r
}

describe('la table tient à 53 lignes, pas à 4', () => {
  it('UNE ligne par boutique — aucune troncature muette', async () => {
    const { container } = await ouvrirOnglet()
    const lignes = container.querySelectorAll('tbody tr')
    // ⚠️ Assertion de COUVERTURE : un `slice(0, 20)` ajouté « pour la performance »
    // rendrait tous les autres cas verts sur un sous-ensemble.
    expect(lignes.length).toBe(CLIENTES + FIXTURES)
  })

  it('la table défile DANS son conteneur — la page ne déborde jamais', async () => {
    const { container } = await ouvrirOnglet()
    // ⚠️ jsdom ne fait pas de mise en page : on ne peut pas mesurer un débordement, on peut
    // seulement garantir la STRUCTURE qui l'empêche. `.table-wrap` porte `overflow-x:auto`
    // (`index.css:283`), donc les 1 148 px minimums de la table défilent à l'intérieur au
    // lieu de pousser `.page-content`. Le rendu à 390 px reste à vérifier sur capture.
    const wrap = container.querySelector('.table-wrap')
    expect(wrap).toBeTruthy()
    expect(wrap!.querySelector('table')).toBeTruthy()
  })

  it('le MRR est une COLONNE — il ne vivait que dans le tiroir', async () => {
    await ouvrirOnglet()
    const th = await screen.findByRole('columnheader', { name: /MRR/ })
    expect(th).toBeInTheDocument()
  })

  it('chaque ligne a autant de cellules que la table a de colonnes', async () => {
    const { container } = await ouvrirOnglet()
    const nbCol = container.querySelectorAll('thead th').length
    const decalees = [...container.querySelectorAll('tbody tr')]
      .filter(tr => tr.querySelectorAll('td').length !== nbCol)
    // Une ligne plus courte décale toutes les colonnes à sa droite — invisible à 4 lignes.
    expect(decalees).toHaveLength(0)
  })
})

describe('les fixtures sont VISIBLES, badgées, et hors des montants', () => {
  it('elles restent dans la table', async () => {
    const { container } = await ouvrirOnglet()
    expect(container.textContent).toMatch(/Boutique 90/)
  })

  it('leur MRR vaut « — », jamais un montant', async () => {
    const { container } = await ouvrirOnglet()
    const ligne = [...container.querySelectorAll('tbody tr')]
      .find(tr => tr.textContent?.includes('Boutique 90'))!
    const cellules = [...ligne.querySelectorAll('td')].map(td => td.textContent?.trim())
    // La colonne MRR est l'avant-avant-dernière (… CA, MRR, activité, chevron).
    expect(cellules[cellules.length - 3]).toBe('—')
  })

  it('exactement 3 lignes portent le badge démo / test', async () => {
    const { container } = await ouvrirOnglet()
    const badgees = [...container.querySelectorAll('tbody tr')]
      .filter(tr => /démo \/ test/i.test(tr.textContent ?? ''))
    expect(badgees).toHaveLength(FIXTURES)
  })
})

describe('les cellules monétaires ne s’enroulent jamais', () => {
  it('CA et MRR portent `white-space: nowrap`, y compris à 9 chiffres', async () => {
    const { container } = await ouvrirOnglet()
    // ⚠️ jsdom ne fait pas de mise en page : on ne peut pas OBSERVER un retour à la ligne.
    // On vérifie donc la propriété qui le rend IMPOSSIBLE, sur toutes les lignes — et le
    // jeu contient des montants à 9 chiffres, la forme qui a produit le défaut.
    const lignes = [...container.querySelectorAll('tbody tr')]
    const fautives: string[] = []
    for (const tr of lignes) {
      const tds = [...tr.querySelectorAll('td')] as HTMLElement[]
      // … CA, MRR, activité, chevron → indices −4 et −3.
      for (const idx of [tds.length - 4, tds.length - 3]) {
        if (tds[idx].style.whiteSpace !== 'nowrap') fautives.push(`${tr.textContent?.slice(0, 18)} · cellule ${idx}`)
      }
    }
    expect(fautives, fautives.join('\n')).toEqual([])
  })

  it('le jeu de test CONTIENT bien un montant à 9 chiffres', async () => {
    // Assertion de couverture : sans elle, la règle ci-dessus serait verte sur des montants
    // courts, c'est-à-dire sur le cas qui n'a jamais posé problème.
    const { container } = await ouvrirOnglet()
    expect(container.textContent).toMatch(/987[\s\u202f\u00a0]?654[\s\u202f\u00a0]?321/)
  })
})

describe('les colonnes chiffrées sont lisibles en colonne', () => {
  it('en-têtes numériques alignés à droite (`th-num`, miroir de `td-num`)', async () => {
    const { container } = await ouvrirOnglet()
    const num = container.querySelectorAll('thead th.th-num')
    // Users, Produits, Ventes, CA, MRR.
    expect(num.length).toBe(5)
  })

  it('les cellules chiffrées portent `tabular-nums`', async () => {
    const { container } = await ouvrirOnglet()
    const premiere = container.querySelector('tbody tr')!
    const chiffrees = [...premiere.querySelectorAll('td.td-num')] as HTMLElement[]
    expect(chiffrees.length).toBe(5)
    for (const td of chiffrees) expect(td.style.fontVariantNumeric).toBe('tabular-nums')
  })

  it('le tri par colonne est un BOUTON, annoncé par `aria-sort`', async () => {
    await ouvrirOnglet()
    const th = await screen.findByRole('columnheader', { name: /MRR/ })
    // ⚠️ Un `<th>` cliquable sans bouton est inatteignable au clavier et muet pour un
    // lecteur d'écran — la version « ça marche à la souris » du signal sans légende.
    expect(th.querySelector('button')).toBeTruthy()
    expect(th.getAttribute('aria-sort')).toBeTruthy()
  })
})

describe('une seule cellule colorée — celle qui appelle une action', () => {
  it('une boutique cliente sans vente depuis > 14 j est signalée, pas les autres', async () => {
    adminApi.tenants.mockResolvedValue([
      tenant('recente', 1, { lastActivityAt: new Date().toISOString() }),
      tenant('ancienne', 2, { lastActivityAt: new Date(Date.now() - 40 * 86400000).toISOString() }),
      // ⚠️ Une FIXTURE inactive n'appelle aucune action : la couleur signale, elle ne décore pas.
      tenant('demo-tenant-001', 3, { isFixture: true, lastActivityAt: new Date(Date.now() - 40 * 86400000).toISOString() }),
    ])
    const { container } = await ouvrirOnglet()
    const cellules = (nom: string) => {
      const tr = [...container.querySelectorAll('tbody tr')].find(x => x.textContent?.includes(nom))!
      return [...tr.querySelectorAll('td')] as HTMLElement[]
    }
    const alerte = (nom: string) => cellules(nom).filter(td => td.style.color.includes('--warn')).length
    expect(alerte('Boutique 02')).toBe(1)   // cliente inactive → signalée
    expect(alerte('Boutique 01')).toBe(0)   // cliente active   → neutre
    expect(alerte('Boutique 03')).toBe(0)   // fixture          → neutre
  })
})
