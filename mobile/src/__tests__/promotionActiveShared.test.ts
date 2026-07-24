import { readFileSync } from 'fs'
import { join } from 'path'
import { isPromotionActive } from '@/stores/posStore'

// Anti-dérive du miroir mobile ↔ backend ↔ frontend : ce test ET ses jumeaux
// apps/backend/src/tests/promotionActiveShared.test.ts + apps/frontend/src/lib/pricing.test.ts
// lisent le MÊME fichier de cas. La règle d'expiration d'une promo doit rester identique des
// trois côtés (le backend est autoritaire sur le prix : une divergence ferait facturer autre
// chose que ce que le mobile affiche).
interface Case { label: string; hasPromotion: boolean; end: string | null; now: string; expected: boolean }
const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../../docs/shared-fixtures/promotion-active-cases.json'), 'utf8'),
) as { cases: Case[] }

describe('isPromotionActive — cas PARTAGÉS mobile/backend/frontend (anti-dérive)', () => {
  for (const c of fixture.cases) {
    it(c.label, () => {
      expect(isPromotionActive(c.hasPromotion, c.end, new Date(c.now))).toBe(c.expected)
    })
  }
})
