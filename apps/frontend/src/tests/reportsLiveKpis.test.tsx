import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Rapports — les KPI viennent des DONNÉES, plus de littéraux fabriqués.
 *
 * L'onglet Stock affirmait « 142 articles / 7 en rupture » à un commerçant qui en a 12 et 2,
 * l'onglet RH un effectif de 8 avec une équipe inventée. Le même écran se contredisait :
 * le bloc serveur disait « À réapprovisionner : 2 » au-dessus du bloc fabriqué « 7 ».
 *
 * ⚠️ Un rapport qui invente est pire qu'un rapport absent — c'est un support de décision,
 * un commerçant commande son stock dessus. D'où : aucun repli, trois états distincts.
 */
const { mockState, products, employees, customers } = vi.hoisted(() => ({
  mockState: { lang: 'fr', currency: 'XOF', theme: 'dark' as string },
  products: vi.fn(), employees: vi.fn(), customers: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  productsApi: { list: products },
  employeesApi: { list: employees },
  customersApi: { list: customers },
}))
vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  const useAppStore = Object.assign(
    vi.fn((sel?: (s: typeof mockState) => unknown) => (sel ? sel(mockState) : mockState)),
    { getState: () => mockState },
  )
  return { ...actual, useAppStore }
})

import { StockKpis, HrKpis, ClientSegments } from '@/components/reports/ReportsLiveKpis'

const i = (fr: string) => fr
const fmt = (n: number) => `${n.toLocaleString('fr-FR')} F`
const never = () => new Promise<never>(() => undefined)

beforeEach(() => {
  vi.clearAllMocks()
  products.mockResolvedValue([]); employees.mockResolvedValue([]); customers.mockResolvedValue([])
})

// ─── (a) Aucun littéral fabriqué dans ReportsTabs ────────────────────────────
describe('⚠️ ReportsTabs ne contient plus de nombre FABRIQUÉ', () => {
  const SRC = readFileSync(join(process.cwd(), 'src/components/reports/ReportsTabs.tsx'), 'utf8')
  /** Code exécuté seulement : un commentaire qui cite « 142 » ne doit pas faire rougir. */
  const CODE = SRC
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

  it('le scan lit bien le fichier (un scan vide ne garderait rien)', () => {
    expect(CODE.length).toBeGreaterThan(2000)
    expect(CODE).toContain('StockKpis')
  })

  /**
   * ⚠️ Cible les nombres qui ATTEIGNENT L'ÉCRAN, pas tous les nombres du fichier : un
   * premier jet interdisait « ≥ 3 chiffres » et rougissait sur les composantes `rgba(140,…)`
   * et les opacités `0.35`. Un verrou qui crie au loup se fait désarmer — il ne garde alors
   * plus rien. Les 18 littéraux supprimés avaient tous la MÊME forme : un nombre rendu comme
   * texte JSX, ou posé dans un champ `value:`/`qty:`/`pct:` d'un objet fabriqué.
   */
  it('aucun nombre rendu comme TEXTE JSX (c’était la forme des KPI fabriqués)', () => {
    // `>142<` ou `>4.2 j<` — un littéral qui sort tel quel à l'écran.
    const rendered = [...CODE.matchAll(/>\s*(\d[\d\s.,]*)\s*(?:[a-zA-Zà-ÿ%°]{0,3})\s*</g)].map(m => m[1].trim())
    expect(rendered).toEqual([])
  })

  it('aucun objet fabriqué : pas de `value:`/`qty:`/`pct:`/`count:` numérique en dur', () => {
    const fabricated = [...CODE.matchAll(/\b(?:value|qty|pct|count|total|amount|days|nb)\s*:\s*(-?\d+(?:\.\d+)?)\b/g)].map(m => m[0])
    expect(fabricated).toEqual([])
  })

  it('les KPI passent par les composants de données, pas par du littéral', () => {
    for (const bloc of ['StockKpis', 'HrKpis', 'ClientSegments']) expect(CODE).toContain(bloc)
  })
})

// ─── (b) Trois états, pour chaque bloc ───────────────────────────────────────
describe('trois états DISTINCTS, aucun repli', () => {
  const blocks = [
    ['Stock', () => <StockKpis fmt={fmt} i={i} />, products],
    ['RH', () => <HrKpis fmt={fmt} i={i} />, employees],
    ['Clients', () => <ClientSegments fmt={fmt} i={i} lang="fr" />, customers],
  ] as const

  for (const [nom, Block, api] of blocks) {
    it(`${nom} — chargement : ni valeur ni « aucun »`, () => {
      api.mockReturnValue(never())
      render(<Block />)
      expect(screen.getByText('Chargement…')).toBeTruthy()
    })

    it(`${nom} — échec : le dit, et n’invente AUCUN chiffre`, async () => {
      api.mockRejectedValue(new Error('500'))
      render(<Block />)
      expect(await screen.findByText('Données indisponibles.')).toBeTruthy()
      expect(screen.queryByText('0')).toBeNull()
    })
  }

  it('Stock — liste vide : des zéros CONSTATÉS, pas un repli', async () => {
    products.mockResolvedValue([])
    render(<StockKpis fmt={fmt} i={i} />)
    expect(await screen.findByText('Articles en stock')).toBeTruthy()
    expect(screen.getAllByText('0').length).toBeGreaterThan(0)
  })
})

// ─── Les chiffres viennent bien de la charge BRUTE ───────────────────────────
describe('les formules lisent les champs du FIL, pas ceux de l’objet mappé', () => {
  it('Stock : stockQty / stockMin / sellPrice', async () => {
    products.mockResolvedValue([
      { id: 'p1', stockQty: 10, stockMin: 5, sellPrice: 1000 },
      { id: 'p2', stockQty: 2, stockMin: 5, sellPrice: 500 },   // sous le seuil
    ])
    render(<StockKpis fmt={fmt} i={i} />)
    expect(await screen.findByText('2')).toBeTruthy()            // 2 articles
    expect(screen.getByText('11 000 F')).toBeTruthy()            // 10×1000 + 2×500
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)   // 1 en rupture
  })

  it('⚠️ RH : `isActive` du fil, pas `active` de l’objet mappé', async () => {
    // Lire `e.active` sur la charge brute donnait un effectif de 0 : la donnée était là,
    // sous un nom qui n'existe pas à ce niveau.
    employees.mockResolvedValue([
      { id: 'e1', salary: 130000, isActive: true },
      { id: 'e2', salary: 110000, isActive: true },
      { id: 'e3', salary: 999999, isActive: false },
    ])
    render(<HrKpis fmt={fmt} i={i} />)
    expect(await screen.findByText('2')).toBeTruthy()
    expect(screen.getByText('240 000 F')).toBeTruthy()
  })

  it('⚠️ Clients : `totalRevenue` du fil, pas `totalCA`', async () => {
    customers.mockResolvedValue([{ id: 'c1', type: 'wholesale', totalRevenue: 1250000 }])
    render(<ClientSegments fmt={fmt} i={i} lang="fr" />)
    expect(await screen.findByText('1 250 000 F')).toBeTruthy()
  })
})

// ─── (c) Un client SANS palier n'est PAS compté dans « Détail » ──────────────
describe('⚠️ un client sans palier n’est versé dans AUCUN segment', () => {
  it('il est compté à part, pas dans « Détail »', async () => {
    customers.mockResolvedValue([
      { id: 'c1', type: 'retail', totalRevenue: 1000 },
      { id: 'c2', type: null, totalRevenue: 9999 },
      { id: 'c3', type: 'inconnu', totalRevenue: 8888 },
    ])
    render(<ClientSegments fmt={fmt} i={i} lang="fr" />)
    expect(await screen.findByText('Détail')).toBeTruthy()
    // Le CA « Détail » ne doit contenir QUE le vrai client détail : les fondre gonflerait
    // le segment de 18 887 F et inventerait deux clients au détail.
    expect(screen.getByText('1 000 F')).toBeTruthy()
    expect(screen.queryByText('19 887 F')).toBeNull()
    // Et ils sont NOMMÉS, pas escamotés.
    expect(screen.getByText(/2 client\(s\) sans palier renseigné/)).toBeTruthy()
  })

  it('aucun client typé → on le DIT, on n’affiche pas un segment vide', async () => {
    customers.mockResolvedValue([{ id: 'c1', type: null, totalRevenue: 500 }])
    render(<ClientSegments fmt={fmt} i={i} lang="fr" />)
    expect(await screen.findByText('Aucun client avec un palier renseigné.')).toBeTruthy()
    expect(screen.queryByText('Détail')).toBeNull()
  })

  it('les libellés HÉRITÉS sont bien regroupés (juge unique #215)', async () => {
    customers.mockResolvedValue([
      { id: 'c1', type: 'Grossiste', totalRevenue: 100 },
      { id: 'c2', type: 'wholesale', totalRevenue: 200 },
    ])
    render(<ClientSegments fmt={fmt} i={i} lang="fr" />)
    expect(await screen.findByText('Grossistes')).toBeTruthy()
    expect(screen.getByText('300 F')).toBeTruthy()   // un seul segment, pas deux
    expect(screen.getByText('2')).toBeTruthy()
  })
})
