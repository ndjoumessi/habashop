import { readFileSync } from 'fs'
import { join } from 'path'
import { computeLoyaltyDiscount, MAX_TOTAL_DISCOUNT_PCT } from '@/lib/loyalty'

// Anti-dérive du miroir mobile ↔ backend : ce test ET son jumeau
// apps/backend/src/tests/loyaltyDiscountShared.test.ts lisent le MÊME fichier de cas.
// Un changement de la règle d'un seul côté fait échouer l'un des deux tests.
interface Case { label: string; total: number; pct: number; manual: number; expected: number }
const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../../docs/shared-fixtures/loyalty-discount-cases.json'), 'utf8'),
) as { maxTotalDiscountPct: number; cases: Case[] }

describe('computeLoyaltyDiscount — cas PARTAGÉS mobile/backend (anti-dérive)', () => {
  it('plafond partagé = 50 %', () => {
    expect(MAX_TOTAL_DISCOUNT_PCT).toBe(fixture.maxTotalDiscountPct)
  })
  for (const c of fixture.cases) {
    it(c.label, () => {
      expect(computeLoyaltyDiscount(c.total, c.pct, c.manual)).toBe(c.expected)
    })
  }
})
