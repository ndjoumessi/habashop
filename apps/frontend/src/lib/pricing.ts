// Miroir du backend (apps/backend/src/utils/pricing.ts).
// Garder les 2 versions alignées : toute évolution de logique doit toucher les 2.

export type PriceTier = {
  minQty: number
  price: number
  label?: string
}

export type Promotion = {
  active: boolean
  price?: number | null
}

// Miroir EXACT de apps/backend/src/utils/pricing.ts (cas partagés
// docs/shared-fixtures/promotion-active-cases.json). Une promo est active tant que
// `hasPromotion` ET que la date du jour (UTC, YYYY-MM-DD) n'a pas dépassé `promotionEnd`
// (INCLUSIF). Pas d'échéance ('' / null) = promo sans fin (comportement historique).
// `now` INJECTÉ → pure, jamais de littéral de date.
function dayUTC(v: string | Date): string {
  return (typeof v === 'string' ? v : v.toISOString()).slice(0, 10)
}
export function isPromotionActive(
  hasPromotion: boolean | null | undefined,
  promotionEnd: string | Date | null | undefined,
  now: Date,
): boolean {
  if (!hasPromotion) return false
  if (promotionEnd == null || promotionEnd === '') return true
  return dayUTC(now) <= dayUTC(promotionEnd)
}

export function resolveTierPrice(
  qty: number,
  basePrice: number,
  tiers?: PriceTier[] | null,
  promotion?: Promotion | null,
): { price: number; tierLabel?: string } {
  if (promotion?.active && promotion.price != null) {
    return { price: promotion.price }
  }
  if (!tiers?.length) return { price: basePrice }
  const applied = [...tiers]
    .sort((a, b) => b.minQty - a.minQty)
    .find(t => qty >= t.minQty)
  return applied
    ? { price: applied.price, tierLabel: applied.label }
    : { price: basePrice }
}

export function validatePriceTiers(
  tiers: unknown,
): { ok: true; tiers: PriceTier[] } | { ok: false; error: string } {
  if (tiers === null || tiers === undefined) return { ok: true, tiers: [] }
  if (!Array.isArray(tiers)) return { ok: false, error: 'priceTiers must be an array' }
  const seen = new Set<number>()
  const parsed: PriceTier[] = []
  for (const t of tiers) {
    if (!t || typeof t !== 'object') return { ok: false, error: 'Each tier must be an object' }
    const minQty = Number((t as { minQty?: unknown }).minQty)
    const price  = Number((t as { price?: unknown }).price)
    const label  = (t as { label?: unknown }).label
    if (!Number.isFinite(minQty) || minQty < 1 || !Number.isInteger(minQty)) {
      return { ok: false, error: 'minQty must be a positive integer >= 1' }
    }
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: 'price must be a finite number >= 0' }
    }
    if (seen.has(minQty)) return { ok: false, error: `Duplicate minQty: ${minQty}` }
    seen.add(minQty)
    parsed.push({
      minQty,
      price,
      label: typeof label === 'string' && label.trim() ? label.trim() : undefined,
    })
  }
  parsed.sort((a, b) => a.minQty - b.minQty)
  return { ok: true, tiers: parsed }
}
