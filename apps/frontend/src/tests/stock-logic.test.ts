import { describe, it, expect } from 'vitest'
import { stockCatLabel, stockCatDesc, statusOf, productMargin } from '@/components/stock/stockShared'

// Logique métier Stock — pure & exportée. `statusOf` (alertes seuil) est déjà couvert par
// stock-status.test.ts ; la valorisation (stock×prix) est INLINE dans Stock.tsx/StockInventory
// (reduce, non extrait) et la conversion devise est couverte par productCurrency.test.ts.
// Ici : libellés de catégories (i18n + fallback) + 1 cas limite quantité négative.

describe('stockCatLabel — libellé catégorie prédéfinie (i18n, fallback)', () => {
  it('traduit les catégories prédéfinies dans les 4 langues', () => {
    expect(stockCatLabel('Céréales', 'fr')).toBe('Céréales')
    expect(stockCatLabel('Céréales', 'en')).toBe('Cereals')
    expect(stockCatLabel('Céréales', 'es')).toBe('Cereales')
    expect(stockCatLabel('Céréales', 'it')).toBe('Cereali')
    expect(stockCatLabel('Corps gras', 'en')).toBe('Oils & Fats')
  })
  it('catégorie custom (saisie commerçant) → passe inchangée (fallback)', () => {
    expect(stockCatLabel('Boubous brodés', 'en')).toBe('Boubous brodés')
    expect(stockCatLabel('Boubous brodés', 'fr')).toBe('Boubous brodés')
  })
  it('langue inconnue → repli sur la valeur (clé) FR', () => {
    expect(stockCatLabel('Céréales', 'de')).toBe('Céréales')
  })
})

describe('stockCatDesc — description catégorie prédéfinie (i18n, fallback)', () => {
  it('traduit les descriptions prédéfinies', () => {
    expect(stockCatDesc('Riz, farine, semoule...', 'en')).toBe('Rice, flour, semolina...')
    expect(stockCatDesc('Savons, détergents...', 'it')).toBe('Saponi, detergenti...')
  })
  it('description custom → inchangée (fallback)', () => {
    expect(stockCatDesc('Articles de fête locaux', 'en')).toBe('Articles de fête locaux')
  })
})

describe('statusOf — cas limite quantité négative (complément alertes)', () => {
  it('stock négatif (≠ 0) ≤ seuil → "bas" (badge-amber), pas "rupture"', () => {
    // La rupture est réservée à stock === 0 exactement ; un stock négatif (incohérence
    // de données) tombe dans la branche ≤ seuil → bas. Comportement ACTUEL verrouillé.
    expect(statusOf(-5, 10).cls).toBe('badge-amber')
    expect(statusOf(-1, 0).cls).toBe('badge-amber')
  })
})

describe('productMargin — marge commerciale (% sur la vente, profit XOF)', () => {
  // ⚠️ LE cas load-bearing : achat 500, vente 1000. Marge (/vente) = 50 %. Markup (/achat) =
  // 100 %. Diviser par l'achat au lieu de la vente donnerait 100 et resterait « vert » sur des
  // cas où achat = vente/2 ; seul un ratio ≠ 2 les distingue vraiment.
  it('pct = (vente − achat) / VENTE, pas le markup sur le coût', () => {
    const m = productMargin(500, 1000)
    expect(m.pct).toBe(50)          // et surtout PAS 100
    expect(m.profitXof).toBe(500)
  })

  it('vente à perte → pct et profit négatifs', () => {
    const m = productMargin(1000, 800)
    expect(m.pct).toBe(-25)
    expect(m.profitXof).toBe(-200)
  })

  it('vente nulle → pct null (pas de division par zéro), profit = −achat', () => {
    const m = productMargin(600, 0)
    expect(m.pct).toBeNull()
    expect(m.profitXof).toBe(-600)
  })

  it('pct est un ratio SANS unité → indépendant de la devise (XOF vs ×656)', () => {
    expect(productMargin(500, 1000).pct).toBe(productMargin(500 * 656, 1000 * 656).pct)
  })
})
