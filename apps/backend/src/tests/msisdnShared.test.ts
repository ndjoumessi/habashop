import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
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

  /**
   * ⚠️ CHAQUE route de paiement est listée NOMMÉMENT avec sa politique attendue.
   * Ajouter la normalisation dans `mtnPayment.ts` sans l'ajouter ici aurait laissé le
   * nouveau point d'appel libre de basculer — le trou S20, reproduit à l'identique.
   */
  const SITES: { file: string; policy: string; other: string; why: string }[] = [
    { file: 'campayPayment.ts', policy: "'cm-only'", other: "'international'",
      why: 'Campay ne dessert que le Cameroun' },
    { file: 'mtnPayment.ts', policy: "'international'", other: "'cm-only'",
      why: 'le bac à sable MTN utilise des numéros étrangers' },
  ]

  it('toutes les routes de paiement qui prennent un numéro sont listées', () => {
    // Un 3ᵉ prestataire qui normaliserait sans entrer dans SITES ferait échouer CE test.
    const routes = readdirSync(resolve(__dirname, '..', 'routes'))
      .filter(f => f.endsWith('.ts') && /normalizeMsisdn/.test(read(resolve(__dirname, '..', 'routes', f))))
    expect(new Set(routes)).toEqual(new Set(SITES.map(s => s.file)))
  })

  for (const site of SITES) {
    it(`${site.file} exige ${site.policy} — ${site.why}`, () => {
      const src = read(resolve(__dirname, '..', 'routes', site.file))
      const calls = [...src.matchAll(/normalizeMsisdn\([^)]*\)/g)].map(m => m[0])
      expect(calls.length, 'aucun appel trouvé : le scan ou le fichier a bougé').toBe(1)
      expect(calls[0]).toContain(site.policy)
      expect(calls[0]).not.toContain(site.other)
    })

    /**
     * ⚠️ La FORME du refus est verrouillée aussi. Les deux routes avaient déjà divergé
     * dessus (`{ error }` nu d'un côté, `{ error, code }` de l'autre) : verrouiller la
     * politique sans verrouiller le refus laissait l'écart revenir par l'autre bout.
     */
    it(`${site.file} refuse via le corps PARTAGÉ, avec la même politique`, () => {
      const src = read(resolve(__dirname, '..', 'routes', site.file))
      const bodies = [...src.matchAll(/phoneInvalidBody\([^)]*\)/g)].map(m => m[0])
      expect(bodies.length, 'refus non partagé : message écrit à la main ?').toBe(1)
      expect(bodies[0]).toContain(site.policy)
      // Aucun message de refus recopié : il doit être DÉRIVÉ de la politique.
      expect(src).not.toMatch(/error:\s*['"`]Numéro de téléphone invalide/)
    })
  }

  it('le corps de refus est unique et dérive de la politique', async () => {
    const { phoneInvalidBody } = await import('../lib/payments/providerConfig')
    expect(phoneInvalidBody('cm-only').code).toBe('PHONE_INVALID')
    expect(phoneInvalidBody('international').code).toBe('PHONE_INVALID')
    // Le message SUIT la politique — un « format Cameroun attendu » ne doit pas survivre
    // à un passage en international et dire l'inverse de ce que la route accepte.
    expect(phoneInvalidBody('cm-only').error).toMatch(/Cameroun/)
    expect(phoneInvalidBody('international').error).toMatch(/8 à 15/)
    // …et il ne divulgue aucun numéro (PII).
    expect(phoneInvalidBody('cm-only').error).not.toMatch(/\d{6,}/)
  })
})
