import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Bandeau de tarif du POS — il ne doit AFFIRMER que ce qui est vrai.
 *
 * `toPosProduct` replie `wholesalePrice ?? sellPrice` : un produit sans prix de gros a donc
 * `priceWholesale === price`. Le bandeau annonçait quand même « Tarif Grossiste appliqué »
 * au-dessus de prix STRICTEMENT identiques au détail — le commerçant lisait qu'une remise
 * s'appliquait alors qu'il vendait au prix de détail. C'est un écran de caisse : ce qui y
 * est affirmé engage un prix encaissé.
 */
const { mockState } = vi.hoisted(() => ({ mockState: { lang: 'fr', currency: 'XOF', theme: 'dark' as string } }))

vi.mock('@/stores/appStore', async (orig) => {
  const actual = await orig() as Record<string, unknown>
  const useAppStore = Object.assign(
    vi.fn((sel?: (s: typeof mockState) => unknown) => (sel ? sel(mockState) : mockState)),
    { getState: () => mockState },
  )
  return { ...actual, useAppStore, useFormatAmount: () => (n: number) => `${n} F` }
})
vi.mock('@/hooks/useThemeColor', () => ({ useThemeColor: () => '#888' }))
vi.mock('@/lib/api', () => ({ salesApi: { list: vi.fn().mockResolvedValue([]) } }))

import POSProductGrid from '@/components/pos/POSProductGrid'

const P = (over: Record<string, unknown> = {}) => ({
  id: 1, name: 'Riz 5kg', sku: 'R1', barcode: '', price: 1000,
  priceWholesale: 1000, priceSemiWholesale: 1000, cat: 'grocery', emoji: '🌾',
  stock: 10, promotion: false, promotionPrice: 0, promotionEnd: '', ...over,
})

const noop = () => undefined
function grid(clientType: 'retail' | 'wholesale' | 'semi', products: Record<string, unknown>[]) {
  return render(
    <POSProductGrid
      posTab="pos" lang="fr" activeCat="" setActiveCat={noop}
      clientType={clientType} setClientType={noop}
      fmt={(n: number) => `${n} F`} amountLabel={(n: number) => String(n)} curSuffix="F"
      filtered={products as never} cart={[]} addItem={noop} getPrice={(p: never) => (p as { price: number }).price}
      posShowStockOnTile loadingHistory={false} salesHistory={[]}
      canAuditPrices={false} divergenceOnly={false} onToggleDivergence={noop}
      gapFilter="" onGapFilterChange={noop}
      canRefund={false} onRefundClick={noop} canCloseDay={false} onCloseDay={noop}
      isMobile={false} mobileView="grid" totalProducts={products.length}
      loadingProducts={false} navigate={noop}
    />,
  )
}

describe('⚠️ « appliqué » n’est dit que si un prix de palier EXISTE', () => {
  it('aucun produit n’a de prix de gros → message ambre, PAS « appliqué »', () => {
    grid('wholesale', [P(), P({ id: 2, name: 'Sucre' })])
    expect(screen.getByText(/aucun prix pour ce tarif/)).toBeTruthy()
    // ⚠️ Le message de repli se TERMINE lui aussi par « appliqué » (« prix de détail
    // appliqué ») : chercher ce seul mot rendait le test vert-pour-rien. C'est la forme
    // AFFIRMATIVE « Tarif Grossiste appliqué » qui doit être absente.
    expect(document.body.textContent).not.toMatch(/Grossiste\s+appliqué/)
  })

  it('au moins un produit a un vrai prix de gros → « appliqué »', () => {
    grid('wholesale', [P(), P({ id: 2, name: 'Sucre', priceWholesale: 800 })])
    expect(screen.getByText(/appliqué/)).toBeTruthy()
    expect(screen.queryByText(/aucun prix pour ce tarif/)).toBeNull()
  })

  it('le palier SEMI est jugé sur SON propre prix, pas sur celui du gros', () => {
    // Un prix de gros renseigné ne rend pas le semi-gros applicable.
    grid('semi', [P({ priceWholesale: 800 })])
    expect(screen.getByText(/aucun prix pour ce tarif/)).toBeTruthy()
  })

  it('semi avec son prix → « appliqué »', () => {
    grid('semi', [P({ priceSemiWholesale: 900 })])
    expect(screen.getByText(/appliqué/)).toBeTruthy()
  })

  it('en Détail, aucun bandeau (le mode par défaut n’a rien à justifier)', () => {
    grid('retail', [P()])
    expect(screen.queryByText(/appliqué/)).toBeNull()
    expect(screen.queryByText(/aucun prix pour ce tarif/)).toBeNull()
  })
})

describe('⚠️ « Demi-gros » ne réapparaît pas', () => {
  /** Scan de `src/` — le libellé vivait dans DEUX fichiers sans lien (POS et Onboarding). */
  const files: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const full = join(dir, e)
      if (statSync(full).isDirectory()) { if (e !== 'node_modules') walk(full) }
      else if (/\.tsx?$/.test(e) && !full.includes('posTierBanner.test')) files.push(full)
    }
  }
  walk(join(process.cwd(), 'src'))

  it('le scan couvre bien des fichiers (un walk cassé ne garderait rien)', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('aucun fichier ne contient le libellé « Demi-gros »', () => {
    // ⚠️ Négatif sur « siste » : `landingShared.ts` porte « Demi-grossiste · Bamako », le
    // MÉTIER d'un témoignage, pas le libellé du palier. Interdire la sous-chaîne ferait
    // rougir sur une chaîne sans rapport — un verrou qui crie au loup finit désarmé.
    const hits = files.filter(f => /Demi-gros(?!siste)/.test(readFileSync(f, 'utf8')))
      .map(f => f.replace(process.cwd(), ''))
    expect(hits).toEqual([])
  })

  it('⚠️ la VALEUR `semiwholesale` de shopType est intacte — axe distinct du palier client', () => {
    // Renommer la valeur casserait les tenants existants : `shopType` décrit le type de
    // COMMERCE, pas le palier d'un client. Seul le libellé a changé.
    const onboarding = readFileSync(join(process.cwd(), 'src/pages/Onboarding.tsx'), 'utf8')
    expect(onboarding).toContain("v: 'semiwholesale'")
  })
})
