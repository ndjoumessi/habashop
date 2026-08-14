import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import POSProductGrid from '@/components/pos/POSProductGrid'
import { niveauStock, toPosProduct } from '@/components/pos/posShared'
import { statusOf } from '@/components/stock/stockShared'

/**
 * LE SEUIL D'ALERTE VIENT DU PRODUIT, ET LE NOM PASSE DEVANT LE PRIX.
 *
 * Deux défauts mesurés le 2026-08-14 sur la grille de caisse déployée :
 *  (a) `isLowStock = p.stock < 20` — un LITTÉRAL identique pour tous les produits, alors
 *      que `Product.stockMin` existe, est éditable dans Stock (colonne « Seuil ») et sert
 *      déjà de critère à TROIS autres endroits. Le POS ne recevait même pas le champ.
 *  (b) le prix était rendu à 13 px dans la couleur la plus saturée de la palette, le nom
 *      à 12 px — l'identité du produit passait derrière son montant.
 */

const noop = () => undefined

/** Monte la grille avec les produits donnés (mêmes props que `posTierBanner`). */
function monter(products: unknown[]) {
  return render(
    <POSProductGrid
      posTab="pos" lang="fr" activeCat="" setActiveCat={noop}
      clientType="retail" setClientType={noop}
      fmt={(n: number) => `${n} F`} amountLabel={(n: number) => String(n)} curSuffix="F"
      filtered={products as never} cart={[]} addItem={noop} getPrice={(p: { price: number }) => p.price}
      posShowStockOnTile loadingHistory={false} salesHistory={[]}
      canAuditPrices={false} divergenceOnly={false} onToggleDivergence={noop}
      gapFilter="none" onGapFilterChange={noop}
      canRefund={false} onRefundClick={noop} canCloseDay={false} onCloseDay={noop}
      isMobile={false} mobileView="grid" totalProducts={products.length}
      loadingProducts={false} navigate={noop}
    />,
  )
}

const produit = (o: Record<string, unknown>) => ({
  id: 1, name: 'Farine blé 1kg', price: 650, priceWholesale: 520, priceSemiWholesale: 590,
  cat: 'cereals', emoji: '🌾', stock: 25, stockMin: 30,
  promotion: false, promotionPrice: 0, promotionEnd: '', ...o,
})

describe('(a) la règle de seuil est celle du COMMERÇANT', () => {
  it('⚠️ JUMEAU de l’écran Stock — les deux verdicts ne peuvent pas diverger', () => {
    // `statusOf` (Stock), `server.ts` et `reports.ts` utilisent tous `stock <= stockMin`.
    // Le POS était le SEUL à comparer à 20. Ce cas interdit qu'il redivergе.
    for (const [stock, seuil] of [[0, 5], [3, 5], [5, 5], [6, 5], [25, 30], [31, 30], [19, 10], [100, 0]] as const) {
      const posLabel = niveauStock(stock, seuil)
      const stockCls = statusOf(stock, seuil).cls
      const attendu = stockCls === 'badge-red' ? 'rupture' : stockCls === 'badge-amber' ? 'bas' : 'ok'
      expect(posLabel, `stock=${stock} seuil=${seuil} : POS dit « ${posLabel} », Stock dit « ${attendu} »`).toBe(attendu)
    }
  })

  it('⚠️ SEULE divergence assumée : un stock NÉGATIF est une rupture, pas un stock bas', () => {
    // `statusOf` teste `=== 0` ; le POS teste `<= 0`. Une désynchronisation ne doit pas
    // s'afficher en ambre « il en reste un peu ».
    expect(niveauStock(-3, 5)).toBe('rupture')
  })

  it('un seuil à ZÉRO n’alerte jamais — c’est « pas d’alerte », pas « toujours »', () => {
    expect(niveauStock(1, 0)).toBe('ok')
    expect(niveauStock(0, 0)).toBe('rupture')
  })

  it('`toPosProduct` TRANSPORTE le seuil — il ne le recevait même pas', () => {
    expect(toPosProduct({ id: 'p1', name: 'X', sellPrice: 100, stockQty: 25, stockMin: 30 }).stockMin).toBe(30)
    // ⚠️ ABSENCE ⇒ 0, jamais un seuil inventé : un repli à 5 ferait crier des tuiles sur
    // un seuil que personne n'a choisi.
    expect(toPosProduct({ id: 'p1', name: 'X', sellPrice: 100, stockQty: 25 }).stockMin).toBe(0)
  })

  it('⚠️ LE CAS QUE L’ANCIENNE RÈGLE JUGEAIT À L’ENVERS, sur le rendu', async () => {
    // stock 25, seuil 30 : l'ancienne règle (`< 20`) disait « ok », le commerçant a
    // demandé une alerte. C'est le cas qui apparaîtra au premier réassort — sur les 13
    // produits d'aujourd'hui les deux règles s'accordent encore, le défaut est LATENT.
    monter([produit({ stock: 25, stockMin: 30 })])
    const tuile = screen.getByRole('button', { name: /Farine blé 1kg/ })
    // La pastille porte la couleur d'alerte du thème, pas celle du « tout va bien ».
    const pastille = [...tuile.querySelectorAll('div')].find(d => d.textContent?.trim() === '25')
    expect(pastille, 'la pastille de stock doit être rendue').toBeTruthy()
    expect(pastille!.style.color).toContain('--warn')
  })

  it('DISCRIMINANT — au-dessus du seuil, la même tuile redevient verte', () => {
    // Sans ce cas, une règle qui alerterait TOUJOURS passerait le test précédent.
    monter([produit({ stock: 31, stockMin: 30 })])
    const tuile = screen.getByRole('button', { name: /Farine blé 1kg/ })
    const pastille = [...tuile.querySelectorAll('div')].find(d => d.textContent?.trim() === '31')
    expect(pastille!.style.color).toContain('--acc2')
  })
})

describe('(b) le NOM passe devant le PRIX', () => {
  it('le nom est rendu plus grand que le montant', () => {
    // ⚠️ Assertion sur le DOM RENDU, pas sur le source : c'est ce qui s'affiche qui
    // décide. Les deux tailles sont des jetons, comparés par leur nom — `--fs-sm` (13 px)
    // pour le nom, `--fs-label` (12 px) pour le prix.
    monter([produit({ stock: 100, stockMin: 5 })])
    const tuile = screen.getByRole('button', { name: /Farine blé 1kg/ })
    const nom = [...tuile.querySelectorAll('div')].find(d => d.textContent?.trim() === 'Farine blé 1kg')
    const montant = [...tuile.querySelectorAll('span')].find(s => s.textContent?.trim() === '650')

    expect(nom!.style.fontSize).toBe('var(--fs-sm)')
    expect(montant!.style.fontSize).toBe('var(--fs-label)')
  })

  it('⚠️ le SYMBOLE de devise reste APPARIÉ au montant — décision antérieure préservée', () => {
    // Le symbole avait été délavé à 10 px dans un `color-mix` ; il a été ramené à la
    // taille et à la couleur du chiffre parce que XOF et EUR diffèrent d'un facteur 656.
    // Réduire le prix ne doit pas rouvrir ce défaut : les deux bougent ENSEMBLE.
    monter([produit({ stock: 100, stockMin: 5 })])
    const tuile = screen.getByRole('button', { name: /Farine blé 1kg/ })
    const spans = [...tuile.querySelectorAll('span')]
    const montant = spans.find(s => s.textContent?.trim() === '650')
    const symbole = spans.find(s => s.textContent?.trim() === 'F')
    expect(symbole, 'le suffixe de devise doit être rendu').toBeTruthy()
    expect(symbole!.style.fontSize).toBe(montant!.style.fontSize)
    expect(symbole!.style.color).toBe(montant!.style.color)
  })
})
