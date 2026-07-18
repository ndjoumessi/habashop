import { describe, it, expect } from 'vitest'
import { showStrikePrice } from '@/components/pos/posShared'

// Fix affichage : le prix barré (référence) ne doit apparaître QUE s'il dépasse le
// prix effectif — sinon « 2 800 2 800 FCFA » en Grossiste/Demi-gros sur les produits
// sans tarif de gros distinct (le tarif retombe sur le prix détail).
describe('showStrikePrice — prix barré uniquement si vrai écart', () => {
  it('référence == effectif (pas de tarif distinct) → PAS de barré (un seul montant)', () => {
    expect(showStrikePrice(2800, 2800)).toBe(false)
  })

  it('référence > effectif (tarif grossiste réel, ou promo) → barré affiché', () => {
    expect(showStrikePrice(2800, 2500)).toBe(true) // gros -300
    expect(showStrikePrice(5000, 4000)).toBe(true) // promo
  })

  it('effectif > référence (cas théorique) → pas de barré', () => {
    expect(showStrikePrice(2800, 3000)).toBe(false)
  })
})
