import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { joursDEssaiRestants } from '../lib/trialDays'

/**
 * ⚠️ CAS PARTAGÉS, lus à l'EXÉCUTION — jamais par `import`. Le contexte Docker du backend est
 * `apps/backend` SEUL : un import statique vers `docs/` compile en local et casse le
 * déploiement en TS2307.
 */
const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'trial-days-left.json'), 'utf-8'),
) as { cases: { nom: string; trialEnds: string | null; now: string; attendu: number }[] }

describe('joursDEssaiRestants — cas partagés avec le frontend', () => {
  it('le fichier de cas est bien lu', () => {
    expect(fixture.cases.length, 'fixture vide → le test ne garde rien').toBeGreaterThanOrEqual(8)
  })

  for (const c of fixture.cases) {
    it(`${c.nom}`, () => {
      expect(joursDEssaiRestants(c.trialEnds, new Date(c.now))).toBe(c.attendu)
    })
  }
})
