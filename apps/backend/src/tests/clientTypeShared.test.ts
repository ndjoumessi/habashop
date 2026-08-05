import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeClientType, CLIENT_TYPES } from '../lib/clientType'

/**
 * Test JUMEAU (front ↔ back) de la règle de palier client (#215), sur les cas partagés.
 * Modifier la règle d'un seul côté fait rougir l'autre.
 */
const FIXTURE = JSON.parse(readFileSync(join(__dirname, '../../../../docs/shared-fixtures/client-type-cases.json'), 'utf8')) as {
  canonical: string[]
  cases: { in: unknown; out: string | null; why: string }[]
}

describe('normalizeClientType — cas PARTAGÉS', () => {
  it('le scan couvre bien des cas (une fixture vide ne garderait rien)', () => {
    expect(FIXTURE.cases.length).toBeGreaterThan(15)
  })

  it('l’ensemble canonique est celui de la fixture', () => {
    expect([...CLIENT_TYPES]).toEqual(FIXTURE.canonical)
  })

  for (const c of FIXTURE.cases) {
    it(`${JSON.stringify(c.in)} → ${JSON.stringify(c.out)} — ${c.why}`, () => {
      expect(normalizeClientType(c.in)).toBe(c.out)
    })
  }
})
