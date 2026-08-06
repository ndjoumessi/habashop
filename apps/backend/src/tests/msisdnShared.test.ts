import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { normalizeMsisdn } from '../lib/msisdn'
import type { MsisdnPolicy } from '../lib/msisdn'

/**
 * Cas PARTAGÉS front ↔ back — `docs/shared-fixtures/msisdn-cases.json`.
 *
 * ⚠️ Lus à l'EXÉCUTION (`readFileSync`), jamais importés : le contexte de build Docker du
 * backend est `apps/backend` seul, et un import hors de cette frontière casserait le
 * déploiement en TS2307 sans que tsc local ne le voie.
 *
 * Remplace `mtn-normalize.test.ts`, qui validait une COPIE manuelle de la fonction.
 */
const FIXTURE = resolve(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'msisdn-cases.json')

interface Case { in: string; cmOnly: string | null; international: string | null; why: string }
const cases: Case[] = JSON.parse(readFileSync(FIXTURE, 'utf8')).cases

describe('couverture (une fixture déplacée rendrait ce test vert et vide)', () => {
  it('lit la fixture partagée', () => {
    expect(cases.length).toBeGreaterThanOrEqual(20)
    expect(cases.every(c => typeof c.in === 'string' && typeof c.why === 'string')).toBe(true)
  })
  it('la fixture couvre les DEUX politiques, pas une seule', () => {
    // Sans cas où les deux diffèrent, on ne prouverait rien du paramètre `policy`.
    const divergents = cases.filter(c => c.cmOnly !== c.international)
    expect(divergents.length, 'aucun cas divergent : la fixture ne teste pas la politique').toBeGreaterThanOrEqual(6)
  })
})

describe.each(['cm-only', 'international'] as MsisdnPolicy[])('normalizeMsisdn — %s', (policy) => {
  const key = policy === 'cm-only' ? 'cmOnly' : 'international'
  for (const c of cases) {
    it(`${JSON.stringify(c.in)} → ${JSON.stringify(c[key as 'cmOnly' | 'international'])} · ${c.why}`, () => {
      expect(normalizeMsisdn(c.in, policy)).toBe(c[key as 'cmOnly' | 'international'])
    })
  }
})

describe('le jumeau backend n’a pas dérivé', () => {
  const body = (p: string) => {
    const s = readFileSync(p, 'utf8')
    return s.slice(s.indexOf('export type MsisdnPolicy'))
  }
  const FRONT = join(resolve(__dirname, '..', '..', '..', '..'), 'apps', 'frontend', 'src', 'lib', 'msisdn.ts')
  const BACK = resolve(__dirname, '..', 'lib', 'msisdn.ts')

  it('les deux fichiers ont un corps IDENTIQUE', () => {
    expect(body(BACK)).toBe(body(FRONT))
  })
  it('… et le corps comparé est non vide', () => {
    expect(body(FRONT).length).toBeGreaterThan(400)
    expect(body(FRONT)).toContain('cm-only')
  })
})

/**
 * ⚠️ LA POLITIQUE EST VERROUILLÉE AU POINT D'APPEL, pas seulement dans le module.
 * Sabotage S20 : basculer `POS.tsx` de `'international'` à `'cm-only'` laissait TOUTE la
 * suite verte — le bac à sable MTN (numéros suédois) serait mort en silence. Un invariant
 * garanti sur le module ne dit rien de ce que l'appelant en demande.
 */
describe('les points d’appel déclarent la BONNE politique', () => {
  const read = (p: string) => readFileSync(p, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')

  it("campayPayment.ts (Campay) exige 'cm-only' — Campay ne dessert que le Cameroun", () => {
    const src = read(resolve(__dirname, '..', 'routes', 'campayPayment.ts'))
    const calls = [...src.matchAll(/normalizeMsisdn\([^)]*\)/g)].map(m => m[0])
    expect(calls.length, 'aucun appel trouvé : le scan ou le fichier a bougé').toBe(1)
    expect(calls[0]).toContain("'cm-only'")
    expect(calls[0]).not.toContain("'international'")
  })
})
