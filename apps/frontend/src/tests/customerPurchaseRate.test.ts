import { describe, it, expect } from 'vitest'
import { mapApiCustomer, purchaseRateLabel } from '@/components/customers/customersShared'

/**
 * `purchasesPerMonth` côté écran (#215) — le champ était `0` en dur dans le mapper :
 * la fiche d'un grossiste annonçait « 0 commandes » au-dessus de ses 19 achats.
 * Il vient désormais du serveur (fenêtre glissante de 90 j), et s'affiche formaté.
 */

describe('mapApiCustomer — la fréquence vient du SERVEUR', () => {
  it('lit `purchasesPerMonth` du fil au lieu de le figer à 0', () => {
    expect(mapApiCustomer({ id: 'c1', name: 'Awa', purchasesPerMonth: 4.3 }).purchasesPerMonth).toBe(4.3)
  })

  it('une fréquence nulle SERVEUR est transmise telle quelle (zéro constaté)', () => {
    expect(mapApiCustomer({ id: 'c1', name: 'Awa', purchasesPerMonth: 0 }).purchasesPerMonth).toBe(0)
  })

  it('champ ABSENT (backend antérieur) → repli 0, mais c’est le seul cas', () => {
    expect(mapApiCustomer({ id: 'c1', name: 'Awa' }).purchasesPerMonth).toBe(0)
  })

  it('une valeur non numérique ne devient pas NaN à l’écran', () => {
    expect(mapApiCustomer({ id: 'c1', name: 'Awa', purchasesPerMonth: 'beaucoup' }).purchasesPerMonth).toBe(0)
  })
})

describe('purchaseRateLabel — un taux décimal reste lisible', () => {
  it('sépare les décimales à la française, jamais avec un point anglais', () => {
    expect(purchaseRateLabel(0.7, 'fr')).toBe('0,7')
    expect(purchaseRateLabel(6.3, 'fr')).toBe('6,3')
  })

  it('n’écrit pas « 5,0 » pour un entier', () => {
    expect(purchaseRateLabel(5, 'fr')).toBe('5')
    expect(purchaseRateLabel(0, 'fr')).toBe('0')
  })

  it('suit la langue de l’interface', () => {
    expect(purchaseRateLabel(0.7, 'en')).toBe('0.7')
    expect(purchaseRateLabel(0.7, 'it')).toBe('0,7')
  })

  it('une entrée absurde rend « 0 », jamais « NaN »', () => {
    expect(purchaseRateLabel(NaN as unknown as number, 'fr')).toBe('0')
    expect(purchaseRateLabel(undefined as unknown as number, 'fr')).toBe('0')
  })
})
