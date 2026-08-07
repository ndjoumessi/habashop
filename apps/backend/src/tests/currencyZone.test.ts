import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cfaZoneOf, currencyOfZone, isCurrencyZoneConflict, currencyZoneError } from '../lib/currencyZone'

/**
 * ⚠️ Fixture lue à l'EXÉCUTION (`readFileSync`), jamais par `import` : le contexte Docker du
 * backend est `apps/backend` SEUL — un import statique de `docs/` compile en local et casse
 * le déploiement en TS2307. Convention des 8 autres jumeaux.
 */
const FIXTURE = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', '..', 'docs', 'shared-fixtures', 'currency-zones.json'), 'utf-8'),
) as {
  zones: Record<string, { currency: string; countries: string[] }>
  _cas: { country: string; currency: string; conflit: boolean; pourquoi: string }[]
}

describe('zone franc CFA — cas PARTAGÉS (déplacer un pays d’un seul côté fait rougir l’autre)', () => {
  it('le scan couvre des cas — une fixture vide serait un vert qui ne garde rien', () => {
    expect(FIXTURE._cas.length).toBeGreaterThanOrEqual(12)
  })

  for (const c of FIXTURE._cas) {
    it(`${c.country}/${c.currency} → ${c.conflit ? 'CONFLIT' : 'accepté'} — ${c.pourquoi}`, () => {
      expect(isCurrencyZoneConflict(c.country, c.currency)).toBe(c.conflit)
    })
  }

  it('les deux tables du module sont celles de la fixture, à l’identique', () => {
    for (const [zone, def] of Object.entries(FIXTURE.zones)) {
      for (const pays of def.countries) {
        expect(cfaZoneOf(pays)).toBe(zone)
        expect(currencyOfZone(zone as 'UEMOA' | 'CEMAC')).toBe(def.currency)
      }
    }
    const total = Object.values(FIXTURE.zones).reduce((n, z) => n + z.countries.length, 0)
    expect(total).toBe(14) // 8 UEMOA + 6 CEMAC — un pays retiré fait rougir ici
  })
})

describe('contrôle DISCRIMINANT — il doit rougir sur SN/XAF et PAS sur CM/XAF', () => {
  it('rougit sur le défaut mesuré en production', () => {
    expect(isCurrencyZoneConflict('SN', 'XAF')).toBe(true)
  })
  it('ne rougit PAS sur le marché par défaut', () => {
    expect(isCurrencyZoneConflict('CM', 'XAF')).toBe(false)
  })
  it('ne rougit PAS sur e2e-tenant (SN/EUR) — AUCUNE exemption nommée n’est nécessaire', () => {
    expect(isCurrencyZoneConflict('SN', 'EUR')).toBe(false)
  })
  it('GA est CEMAC bien que sa TVA vaille 18 % comme l’UEMOA — le cas qu’une dérivation par le taux aurait manqué', () => {
    expect(isCurrencyZoneConflict('GA', 'XOF')).toBe(true)
    expect(isCurrencyZoneConflict('GA', 'XAF')).toBe(false)
  })
  it('un pays hors zone ne contraint rien — non concluant, jamais une affirmation', () => {
    expect(cfaZoneOf('FR')).toBeNull()
    expect(isCurrencyZoneConflict('FR', 'XOF')).toBe(false)
  })
  it('une entrée non conforme ne lève pas — le pays vient d’un JSON d’API', () => {
    for (const v of [null, undefined, 42, {}, [], '']) {
      expect(() => isCurrencyZoneConflict(v, 'XAF')).not.toThrow()
      expect(isCurrencyZoneConflict(v, 'XAF')).toBe(false)
    }
    expect(isCurrencyZoneConflict('SN', null)).toBe(false)
  })
  it('la casse ne change pas le verdict', () => {
    expect(isCurrencyZoneConflict('sn', 'xaf')).toBe(true)
  })
  it('le message est DÉRIVÉ de la zone, pas écrit à la main', () => {
    expect(currencyZoneError('SN', 'XAF')).toContain('UEMOA')
    expect(currencyZoneError('SN', 'XAF')).toContain('XOF')
    expect(currencyZoneError('CM', 'XOF')).toContain('CEMAC')
    expect(currencyZoneError('CM', 'XOF')).toContain('XAF')
  })
})
