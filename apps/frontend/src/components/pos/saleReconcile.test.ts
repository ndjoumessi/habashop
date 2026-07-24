import { describe, it, expect } from 'vitest'
import { reconcileSaleTotal, authoritativeTotal, RECONCILE_TOLERANCE } from './saleReconcile'

// ⚠️ Chantier B, surface (c). Le serveur re-tarife quand le catalogue du terminal est périmé,
// mais le front JETAIT sa réponse : caissier encaisse 1 000, vente enregistrée à 1 200, caisse
// courte à la clôture sans cause explicable — et ticket papier + reçu WhatsApp affichant un
// montant que la facture PDF contredit.

describe('reconcileSaleTotal', () => {
  it('serveur a facturé PLUS → réclamer la différence', () => {
    expect(reconcileSaleTotal(1200, 1000)).toEqual({ gap: 200, action: 'claim' })
  })

  it('serveur a facturé MOINS → rendre la différence', () => {
    expect(reconcileSaleTotal(800, 1000)).toEqual({ gap: -200, action: 'refund' })
  })

  it('totaux concordants → aucune alerte', () => {
    expect(reconcileSaleTotal(1000, 1000)).toBeNull()
  })

  it('écart d’arrondi (≤ tolérance) → aucune alerte', () => {
    expect(reconcileSaleTotal(1000 + RECONCILE_TOLERANCE, 1000)).toBeNull()
    expect(reconcileSaleTotal(1000 - RECONCILE_TOLERANCE, 1000)).toBeNull()
  })

  it('juste au-dessus de la tolérance → alerte (la borne ne doit pas avaler un écart réel)', () => {
    expect(reconcileSaleTotal(1000 + RECONCILE_TOLERANCE + 1, 1000)).toEqual({ gap: 2, action: 'claim' })
  })

  // On ne fabrique JAMAIS une alerte d'argent depuis une donnée absente.
  it('total serveur absent / illisible → aucune alerte', () => {
    expect(reconcileSaleTotal(undefined, 1000)).toBeNull()
    expect(reconcileSaleTotal(null, 1000)).toBeNull()
    expect(reconcileSaleTotal('abc', 1000)).toBeNull()
    expect(reconcileSaleTotal(NaN, 1000)).toBeNull()
  })

  it('total client illisible → aucune alerte', () => {
    expect(reconcileSaleTotal(1200, NaN)).toBeNull()
  })
})

describe('authoritativeTotal — ce qu’on imprime pour le CLIENT', () => {
  it('le serveur fait foi dès qu’il a répondu', () => {
    expect(authoritativeTotal(1200, 1000)).toBe(1200)
  })

  it('serveur illisible → repli sur le total client (jamais NaN sur un ticket)', () => {
    expect(authoritativeTotal(undefined, 1000)).toBe(1000)
    expect(authoritativeTotal('x', 1000)).toBe(1000)
  })

  // Number(null) === 0 : sans filtre explicite, un total ABSENT imprimait un ticket à 0.
  it('null / chaîne vide → ABSENCE, pas zéro', () => {
    expect(authoritativeTotal(null, 1000)).toBe(1000)
    expect(authoritativeTotal('', 1000)).toBe(1000)
  })

  it('zéro est une valeur VALIDE (vente entièrement remisée), pas une absence', () => {
    expect(authoritativeTotal(0, 1000)).toBe(0)
  })
})
