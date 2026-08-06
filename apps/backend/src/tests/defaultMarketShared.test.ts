import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import { DEFAULT_MARKET, dialCodeFor } from '../lib/defaultMarket'

/**
 * Cas PARTAGÉS front ↔ back ↔ mobile — `docs/shared-fixtures/default-market.json`.
 *
 * ⚠️ Lus à l'EXÉCUTION (`readFileSync`), jamais importés : le contexte de build Docker du
 * backend est `apps/backend` seul, un import hors de cette frontière casse le déploiement
 * en TS2307 sans que `tsc` local ne le voie.
 */
const ROOT = resolve(__dirname, '..', '..', '..', '..')
const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'docs', 'shared-fixtures', 'default-market.json'), 'utf8'))

describe('couverture (une fixture déplacée rendrait ce test vert et vide)', () => {
  it('la fixture est lue et complète', () => {
    for (const k of ['country', 'currency', 'dialCode', 'flag']) expect(FIXTURE[k]).toBeTruthy()
    expect(FIXTURE._previous).toBeTruthy()
  })
})

describe('le module coïncide avec la fixture', () => {
  it('pays, devise, indicatif', () => {
    expect(DEFAULT_MARKET.country).toBe(FIXTURE.country)
    expect(DEFAULT_MARKET.currency).toBe(FIXTURE.currency)
    expect(DEFAULT_MARKET.dialCode).toBe(FIXTURE.dialCode)
  })
  it('l’indicatif du défaut est cohérent avec son pays', () => {
    expect(dialCodeFor(DEFAULT_MARKET.country)).toBe(DEFAULT_MARKET.dialCode)
  })
  it('le marché PRÉCÉDENT n’est plus le défaut', () => {
    expect(DEFAULT_MARKET.country).not.toBe(FIXTURE._previous.country)
    expect(DEFAULT_MARKET.currency).not.toBe(FIXTURE._previous.currency)
    expect(DEFAULT_MARKET.dialCode).not.toBe(FIXTURE._previous.dialCode)
  })
  it('… mais il reste ATTEIGNABLE — on a changé un défaut, pas amputé le produit', () => {
    expect(dialCodeFor(FIXTURE._previous.country)).toBe(FIXTURE._previous.dialCode)
  })
})

describe('les trois jumeaux n’ont pas dérivé', () => {
  const body = (p: string) => {
    const s = readFileSync(p, 'utf8')
    return s.slice(s.indexOf('export const DEFAULT_MARKET'))
  }
  const P = (w: string, ...rest: string[]) => join(ROOT, w, ...rest, 'lib', 'defaultMarket.ts')
  const FRONT = P('apps', 'frontend', 'src'), BACK = P('apps', 'backend', 'src'), MOB = P('mobile', 'src')

  it('les trois fichiers ont un corps IDENTIQUE', () => {
    expect(body(BACK)).toBe(body(FRONT))
    expect(body(MOB)).toBe(body(FRONT))
  })
  it('… et le corps comparé est non vide', () => {
    expect(body(FRONT).length).toBeGreaterThan(900)
    expect(body(FRONT)).toContain('dialCodeFor')
  })
})

describe('l’indicatif est DÉRIVÉ, pas constant — l’étape 2 du chantier', () => {
  it.each([['CM','+237'],['SN','+221'],['CI','+225'],['ML','+223'],['FR','+33'],['GA','+241']])(
    '%s → %s', (iso, code) => expect(dialCodeFor(iso)).toBe(code))

  it('absent, vide ou non servi → le défaut, jamais un pays tiers', () => {
    for (const v of [null, undefined, '', 'ZZ', 42, {}, []]) expect(dialCodeFor(v)).toBe(DEFAULT_MARKET.dialCode)
  })

  it('⚠️ la casse ne change rien (le store peut rendre « cm »)', () => {
    expect(dialCodeFor('cm')).toBe('+237')
    expect(dialCodeFor('sn')).toBe('+221')
  })
})
