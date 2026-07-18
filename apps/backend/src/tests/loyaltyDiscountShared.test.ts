import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { computeLoyaltyDiscount, MAX_TOTAL_DISCOUNT_PCT } from '../lib/loyalty'

// Anti-dérive du miroir backend ↔ mobile : ce test ET son jumeau
// mobile/src/__tests__/loyaltyDiscountShared.test.ts lisent le MÊME fichier de cas.
// Si la règle change d'un côté sans l'autre, l'un des deux tests échoue.
interface Case { label: string; total: number; pct: number; manual: number; expected: number }
const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../../../docs/shared-fixtures/loyalty-discount-cases.json'), 'utf8'),
) as { maxTotalDiscountPct: number; cases: Case[] }

describe('computeLoyaltyDiscount — cas PARTAGÉS backend/mobile (anti-dérive)', () => {
  it('plafond partagé = 50 %', () => {
    expect(MAX_TOTAL_DISCOUNT_PCT).toBe(fixture.maxTotalDiscountPct)
  })
  for (const c of fixture.cases) {
    it(c.label, () => {
      expect(computeLoyaltyDiscount(c.total, c.pct, c.manual)).toBe(c.expected)
    })
  }
})
