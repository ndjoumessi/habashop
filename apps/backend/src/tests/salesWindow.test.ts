import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { salesWindowStart } from '../utils/salesWindow'

/**
 * ⚠️ Fixture chargée à l'EXÉCUTION (`readFileSync`), JAMAIS par `import`. Ce n'est pas un
 * détail de style : l'image Docker du backend ne copie que `src`, `prisma`, `package*.json`,
 * `tsconfig.json` et `scripts` — pas `docs/`. Un `import` du JSON est résolu par tsc à la
 * COMPILATION, donc `npm run build` échoue dans le conteneur (TS2307) et le déploiement
 * Railway est rouge, alors que la suite passe en local. Un chemin lu à l'exécution n'est pas
 * résolu par tsc : le build passe, et le test ne s'exécute jamais dans l'image de prod.
 * C'est la convention des autres jumeaux (cf. `csvInjection.test.ts`) — elle n'était écrite
 * nulle part, et l'enfreindre a cassé la prod le 2026-08-05.
 */
const cases = JSON.parse(readFileSync(
  join(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'sales-window-cases.json'), 'utf-8',
)) as { cases: Array<{ label: string; period: string; now: string; from: string }> }

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
