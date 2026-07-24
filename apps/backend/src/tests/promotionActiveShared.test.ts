import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { isPromotionActive } from '../utils/pricing'

// Anti-dérive du miroir backend ↔ frontend : ce test ET son jumeau
// apps/frontend/src/lib/pricing.test.ts lisent le MÊME fichier de cas. Si la règle
// d'expiration change d'un côté sans l'autre, l'un des deux tests échoue.
interface Case { label: string; hasPromotion: boolean; end: string | null; now: string; expected: boolean }
const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../../../docs/shared-fixtures/promotion-active-cases.json'), 'utf8'),
) as { cases: Case[] }

describe('isPromotionActive — cas PARTAGÉS backend/frontend (anti-dérive)', () => {
  for (const c of fixture.cases) {
    it(c.label, () => {
      expect(isPromotionActive(c.hasPromotion, c.end, new Date(c.now))).toBe(c.expected)
    })
  }
})
