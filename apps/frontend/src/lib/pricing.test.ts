import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isPromotionActive } from './pricing'

// Jumeau de apps/backend/src/tests/promotionActiveShared.test.ts — MÊME fichier de cas.
// La règle d'expiration d'une promo doit rester identique back ↔ front (le backend est
// autoritaire sur le prix : une divergence ferait facturer autre chose que l'affiché).
interface Case { label: string; hasPromotion: boolean; end: string | null; now: string; expected: boolean }
const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../../../docs/shared-fixtures/promotion-active-cases.json'), 'utf8'),
) as { cases: Case[] }

describe('isPromotionActive — cas PARTAGÉS frontend/backend (anti-dérive)', () => {
  for (const c of fixture.cases) {
    it(c.label, () => {
      expect(isPromotionActive(c.hasPromotion, c.end, new Date(c.now))).toBe(c.expected)
    })
  }
})
