import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { salesWindowStart } from '@/components/dashboard/dashboardShared'

/**
 * ⚠️ Fixture chargée à l'EXÉCUTION (`readFileSync`), JAMAIS par `import` — convention des
 * autres jumeaux (cf. `csvInjection.test.ts`, des DEUX côtés). Un `import` de JSON est résolu
 * par tsc à la compilation : il rendait `tsc --noEmit` rouge ici (TS2307) et faisait carrément
 * ÉCHOUER le build Docker du backend, dont l'image ne copie pas `docs/`. La règle n'était
 * écrite nulle part ; l'enfreindre a cassé le déploiement Railway le 2026-08-05.
 */
const cases = JSON.parse(readFileSync(
  join(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'sales-window-cases.json'), 'utf-8',
)) as { cases: Array<Record<string, any>> }

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
