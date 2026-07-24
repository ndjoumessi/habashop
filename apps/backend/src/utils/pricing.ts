export type PriceTier = {
  minQty: number
  price: number
  label?: string
}

export type Promotion = {
  active: boolean
  price?: number | null
}

// ── Expiration d'une promotion ───────────────────────────────────────────────────────
// Une promo est active tant que `hasPromotion` ET que la date du jour n'a pas dépassé
// `promotionEnd` (INCLUSIF : une promo « jusqu'au 31/05 » court tout le 31/05). Comparaison
// au JOUR calendaire en UTC (YYYY-MM-DD) → insensible à l'heure et robuste aux fuseaux
// (le Sénégal est à UTC±0 ; un décalage d'≤1 h fait au pire traîner une promo un peu, jamais
// la couper trop tôt). `promotionEnd` absent ('' ou null) = promo SANS échéance = comportement
// historique (active tant que hasPromotion). Miroir EXACT de apps/frontend/src/lib/pricing.ts
// (cas partagés docs/shared-fixtures/promotion-active-cases.json). ⚠️ `now` est INJECTÉ (pas de
// new Date() interne) → fonction pure, testable, jamais de littéral de date.
function dayUTC(v: string | Date): string {
  return (typeof v === 'string' ? v : v.toISOString()).slice(0, 10)
}
export function isPromotionActive(
  hasPromotion: boolean | null | undefined,
  promotionEnd: string | Date | null | undefined,
  now: Date,
): boolean {
  if (!hasPromotion) return false
  if (promotionEnd == null || promotionEnd === '') return true // pas d'échéance = sans fin
  return dayUTC(now) <= dayUTC(promotionEnd) // inclusif
}

// Résout le prix unitaire selon (qty, basePrice, paliers, promotion).
// Priorité : promo active → palier matchant qty → basePrice fallback.
// ⚠️ `promotion.active` doit DÉJÀ intégrer l'expiration (cf. isPromotionActive) — cette
// fonction reste pure et sans notion de temps ; l'appelant lui passe le booléen effectif.
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

// ── Jeu de tarifs d'un produit à un instant donné ────────────────────────────────────
// Tout ce dont dépend l'ensemble des prix unitaires légitimes. Nommé parce qu'on en
// manipule DEUX : les tarifs COURANTS (ce qu'on facture) et les tarifs PRÉCÉDENTS
// (pour qualifier factuellement une divergence en vente — cf. sales.ts).
export type PricingSet = {
  sellPrice: number
  semiWholesalePrice?: number | null
  wholesalePrice?: number | null
  hasPromotion?: boolean | null
  promotionPrice?: number | null
  priceTiers?: PriceTier[] | null
}

// Champs qui définissent le jeu de tarifs. Toute colonne de prix ajoutée à Product doit
// être ajoutée ICI, sinon un changement de prix cesse d'être instantané­isé (donc une
// divergence légitime cesse d'être qualifiable).
export const PRICING_FIELDS = [
  'sellPrice', 'semiWholesalePrice', 'wholesalePrice',
  'hasPromotion', 'promotionPrice', 'priceTiers',
] as const

// Extrait le jeu de tarifs d'un enregistrement produit (ou d'un instantané JSON relu).
export function toPricingSet(src: Record<string, unknown> | null | undefined): PricingSet | null {
  if (!src || typeof src !== 'object') return null
  const sell = Number((src as { sellPrice?: unknown }).sellPrice)
  if (!Number.isFinite(sell)) return null
  const num = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
  const tiers = (src as { priceTiers?: unknown }).priceTiers
  return {
    sellPrice: sell,
    semiWholesalePrice: num((src as { semiWholesalePrice?: unknown }).semiWholesalePrice),
    wholesalePrice: num((src as { wholesalePrice?: unknown }).wholesalePrice),
    hasPromotion: !!(src as { hasPromotion?: unknown }).hasPromotion,
    promotionPrice: num((src as { promotionPrice?: unknown }).promotionPrice),
    priceTiers: Array.isArray(tiers) ? (tiers as PriceTier[]) : null,
  }
}

// Ensemble des prix unitaires LÉGITIMES à cette quantité : chaque tarif défini
// (détail / demi-gros / gros) résolu via palier + promo. Arrondi à l'entier — le POS
// n'émet pas de sous-unité, et la comparaison se fait sur des entiers des deux côtés.
// ⚠️ Une promo active COURT-CIRCUITE les trois tarifs (cf. resolveTierPrice) : l'ensemble
// se réduit alors au seul prix promo. C'est voulu, pas un oubli.
export function legitimatePrices(qty: number, p: PricingSet): Set<number> {
  const tiers = p.priceTiers?.length ? p.priceTiers : null
  const promo = { active: !!p.hasPromotion, price: p.promotionPrice }
  const out = new Set<number>()
  for (const base of [p.sellPrice, p.semiWholesalePrice, p.wholesalePrice]) {
    if (base != null) out.add(Math.round(resolveTierPrice(qty, base, tiers, promo).price))
  }
  return out
}

// Deux jeux de tarifs produisent-ils la même tarification ? Sert à n'instantané­iser un
// « précédent » que lorsqu'un prix a RÉELLEMENT bougé (renommer un produit ne doit pas
// consommer la profondeur 1 de l'instantané).
export function samePricing(a: PricingSet | null, b: PricingSet | null): boolean {
  if (!a || !b) return a === b
  return (
    a.sellPrice === b.sellPrice &&
    (a.semiWholesalePrice ?? null) === (b.semiWholesalePrice ?? null) &&
    (a.wholesalePrice ?? null) === (b.wholesalePrice ?? null) &&
    !!a.hasPromotion === !!b.hasPromotion &&
    (a.promotionPrice ?? null) === (b.promotionPrice ?? null) &&
    JSON.stringify(a.priceTiers ?? null) === JSON.stringify(b.priceTiers ?? null)
  )
}

// Valide + normalise (tri ASC, doublons interdits, types stricts).
export function validatePriceTiers(
  tiers: unknown,
): { ok: true; tiers: PriceTier[] } | { ok: false; error: string } {
  if (tiers === null || tiers === undefined) return { ok: true, tiers: [] }
  if (!Array.isArray(tiers)) return { ok: false, error: 'priceTiers must be an array' }
  const seen = new Set<number>()
  const parsed: PriceTier[] = []
  for (const t of tiers) {
    if (!t || typeof t !== 'object') {
      return { ok: false, error: 'Each tier must be an object' }
    }
    const minQty = Number((t as { minQty?: unknown }).minQty)
    const price  = Number((t as { price?: unknown }).price)
    const label  = (t as { label?: unknown }).label
    if (!Number.isFinite(minQty) || minQty < 1 || !Number.isInteger(minQty)) {
      return { ok: false, error: 'minQty must be a positive integer >= 1' }
    }
    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: 'price must be a finite number >= 0' }
    }
    if (seen.has(minQty)) {
      return { ok: false, error: `Duplicate minQty: ${minQty}` }
    }
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
