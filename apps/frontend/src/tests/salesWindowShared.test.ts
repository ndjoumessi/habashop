import { describe, it, expect } from 'vitest'
import { salesWindowStart } from '@/components/dashboard/dashboardShared'
import cases from '../../../../docs/shared-fixtures/sales-window-cases.json'

/**
 * Jumeau FRONT des cas partagés de fenêtre. Le jumeau BACK vit dans
 * `apps/backend/src/tests/salesWindow.test.ts` et rejoue le MÊME fichier.
 *
 * ⚠️ Ce n'est pas de la symétrie décorative : le front REMPLIT À 0 les jours sans vente, donc
 * il doit borner la série exactement comme le serveur a borné sa requête. Si le serveur
 * changeait « 3 mois » sans le front, le graphe afficherait des zéros sur des jours que le
 * serveur n'a jamais interrogés — un creux inventé, indiscernable d'une vraie absence de vente.
 */
describe('salesWindowStart (miroir front) — cas partagés', () => {
  it('le fichier de cas est non vide (sinon la boucle serait verte à vide)', () => {
    expect(cases.cases.length).toBeGreaterThanOrEqual(7)
  })

  for (const c of cases.cases) {
    it(c.label, () => {
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
