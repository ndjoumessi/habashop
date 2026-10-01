import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import POSProductGrid from '@/components/pos/POSProductGrid'
import { toPosProduct, categoriesDuCatalogue } from '@/components/pos/posShared'

/**
 * LES PUCES DE CATÉGORIE SONT CELLES DE LA BOUTIQUE — pas une liste écrite d'avance.
 *
 * ⚠️ MESURÉ EN PRODUCTION le 2026-10-01, sur la démo : cliquer « Corps gras » rendait
 * « Aucun produit trouvé ». La liste des puces était un littéral de SEPT entrées
 * (`CATS`) dont les identifiants — `cereals`, `fat`, `grocery`… — étaient comparés à un
 * SLUG fabriqué par `toPosProduct` (`category.toLowerCase().replace(/[éè]/g,'e')…`).
 *
 * ⚠️ Les deux ne coïncidaient presque jamais. Mesuré sur les onze catégories réelles du
 * jeu de démonstration : **deux puces sur sept** pouvaient matcher quoi que ce soit —
 * « Hygiène » par coïncidence lexicale (`hygiene` === `hygiene`), et « Épicerie » qui ne
 * montrait QUE les produits SANS catégorie, via le repli `|| 'grocery'` de la fabrique.
 * Un repli qui assimile une absence à une valeur réelle : la famille du `?? 'cash'`.
 *
 * Ce fichier verrouille la BIJECTION : toute puce doit pouvoir montrer quelque chose, et
 * toute catégorie présente doit avoir sa puce. C'est la seule formulation qui attrape les
 * deux sens du défaut — une liste trop large ET une liste trop étroite.
 */

const noop = () => undefined

function monter(produits: unknown[], activeCat = 'all') {
  return render(
    <POSProductGrid
      posTab="pos" lang="fr" activeCat={activeCat} setActiveCat={noop}
      clientType="retail" setClientType={noop}
      fmt={(n: number) => `${n} F`} amountLabel={(n: number) => String(n)} curSuffix="F"
      filtered={produits as never} cart={[]} addItem={noop} getPrice={(p: { price: number }) => p.price}
      posShowStockOnTile loadingHistory={false} salesHistory={[]}
      canAuditPrices={false} divergenceOnly={false} onToggleDivergence={noop}
      gapFilter="none" onGapFilterChange={noop}
      canRefund={false} onRefundClick={noop} canCloseDay={false} onCloseDay={noop}
      isMobile={false} mobileView="grid" totalProducts={produits.length}
      loadingProducts={false} navigate={noop}
      categories={categoriesDuCatalogue(produits as never)}
    />,
  )
}

/** Produits tels que `GET /api/products` les rend, passés par la fabrique réelle. */
const CATALOGUE = ['Boissons', 'Épicerie', 'Entretien', 'Snacks', 'Papeterie', 'Céréales'].map(
  (categorie, i) => toPosProduct({
    id: i + 1, name: `${categorie} — article`, sellPrice: 1000, category: categorie,
    stockQty: 10, stockMin: 5, emoji: '📦',
  }),
)

describe('categoriesDuCatalogue — la liste vient des produits', () => {
  it('rend les catégories DISTINCTES réellement présentes, triées À LA FRANÇAISE', () => {
    // ⚠️ `localeCompare(…, 'fr')`, pas l'ordre des points de code : « Épicerie » se range
    // avec les E, pas après Z. Mon attente initiale était en ordre ASCII et c'est ELLE qui
    // était fausse — un commerçant cherche « Épicerie » entre « Entretien » et « Papeterie ».
    expect(categoriesDuCatalogue(CATALOGUE)).toEqual(
      ['Boissons', 'Céréales', 'Entretien', 'Épicerie', 'Papeterie', 'Snacks'],
    )
  })

  it('⚠️ une catégorie ABSENTE n’en invente pas une — pas de repli vers « Épicerie »', () => {
    const sansCategorie = toPosProduct({ id: 9, name: 'X', sellPrice: 100, stockQty: 1, stockMin: 0 })
    expect(sansCategorie.cat, 'une absence assimilée à une catégorie réelle est la famille du `?? cash`').toBe('')
    expect(categoriesDuCatalogue([sansCategorie])).toEqual([])
  })

  it('la catégorie est transportée TELLE QUELLE — aucun slug entre le produit et le filtre', () => {
    expect(toPosProduct({ id: 1, name: 'X', sellPrice: 1, category: 'Céréales' }).cat).toBe('Céréales')
    expect(toPosProduct({ id: 1, name: 'X', sellPrice: 1, category: '  Corps gras  ' }).cat).toBe('Corps gras')
  })
})

describe('les puces rendues', () => {
  it('⚠️ DÉCISIF : aucune puce ne peut rester vide — chacune correspond à un produit', () => {
    monter(CATALOGUE)
    const presentes = new Set(CATALOGUE.map(p => p.cat))
    const puces = screen.getAllByRole('button')
      .map(b => b.getAttribute('data-categorie'))
      .filter((v): v is string => v !== null && v !== 'all')
    expect(puces.length, 'aucune puce rendue → le verrou ne garde rien').toBeGreaterThan(0)
    for (const p of puces) {
      expect(presentes.has(p), `la puce « ${p} » ne correspond à aucun produit de la boutique`).toBe(true)
    }
  })

  it('⚠️ et aucune catégorie présente n’est privée de puce', () => {
    monter(CATALOGUE)
    const puces = new Set(screen.getAllByRole('button').map(b => b.getAttribute('data-categorie')))
    for (const p of CATALOGUE) {
      expect(puces.has(p.cat), `« ${p.cat} » existe en boutique mais n’a aucune puce`).toBe(true)
    }
  })

  it('le libellé des puces est TRADUIT quand la catégorie est connue, sinon rendu tel quel', () => {
    const { unmount } = render(<div />); unmount()
    monter(CATALOGUE)
    // « Céréales » est dans la table de traduction partagée ; « Snacks » n'y est pas.
    expect(screen.getByText('Céréales')).toBeInTheDocument()
    expect(screen.getByText('Snacks')).toBeInTheDocument()
  })
})
