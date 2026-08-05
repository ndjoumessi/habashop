import { describe, it, expect } from 'vitest'
import { salesWindowStart } from '../utils/salesWindow'
import cases from '../../../../docs/shared-fixtures/sales-window-cases.json'

/**
 * Jumeau BACKEND des cas partagés de fenêtre. Le jumeau FRONT vit dans
 * `apps/frontend/src/tests/salesWindowShared.test.ts` et rejoue le MÊME fichier.
 *
 * Modifier la règle d'un seul côté fait rougir l'autre — c'est tout l'intérêt : le front
 * remplit à 0 les jours sans vente, donc il doit savoir exactement ce que le serveur a
 * requêté. Un miroir non gardé produirait un axe qui n'est pas la période annoncée.
 */
describe('salesWindowStart — cas partagés', () => {
  it('le fichier de cas est non vide (sinon la boucle serait verte à vide)', () => {
    expect(cases.cases.length).toBeGreaterThanOrEqual(7)
  })

  for (const c of cases.cases) {
    it(c.label, () => {
      // ISO sans fuseau → parsé en heure LOCALE des deux côtés ; l'arithmétique l'est aussi.
      const got = salesWindowStart(c.period, new Date(c.now))
      expect(got.getTime()).toBe(new Date(c.from).getTime())
    })
  }

  it("n'altère pas la date qu'on lui passe", () => {
    const now = new Date('2026-08-05T14:30:00')
    const before = now.getTime()
    salesWindowStart('30days', now)
    expect(now.getTime()).toBe(before)
  })
})
