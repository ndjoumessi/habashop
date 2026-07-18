// Fidélité — règle de gain et paliers (fonctions PURES, testables sans DB).
// Configurable PAR TENANT : pointsPerAmount + seuils bronze/silver passés en
// paramètres. Les défauts reproduisent le comportement v1 (1000 / 2000 / 5000).

export const DEFAULT_POINTS_PER_UNIT = 1000
export const DEFAULT_BRONZE_THRESHOLD = 2000  // pts : seuil Bronze → Silver
export const DEFAULT_SILVER_THRESHOLD = 5000  // pts : seuil Silver → Gold

// ── Loyalty v2 : remises par palier (défauts %) ──
export const DEFAULT_BRONZE_DISCOUNT = 5.0
export const DEFAULT_SILVER_DISCOUNT = 10.0
export const DEFAULT_GOLD_DISCOUNT   = 15.0

export const MAX_TOTAL_DISCOUNT_PCT = 50 // plafond anti-abus : remise totale ≤ 50%

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold'

/**
 * Points gagnés pour un montant payé (TTC, après remise) = floor(montant / pointsPerUnit).
 * pointsPerUnit = nombre d'unités de devise pour 1 point (config tenant).
 */
export function pointsForAmount(amountPaid: number, pointsPerUnit: number = DEFAULT_POINTS_PER_UNIT): number {
  const unit = Number(pointsPerUnit)
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) return 0
  if (!Number.isFinite(unit) || unit < 1) return 0
  return Math.floor(amountPaid / unit)
}

/**
 * % de remise automatique pour un palier donné. Retourne 0 si la remise n'est
 * pas configurée ou si enableLoyalty est false. Fonctions PURES — pas d'accès DB.
 */
export function discountForTier(
  tier: LoyaltyTier,
  bronzeDiscount: number = DEFAULT_BRONZE_DISCOUNT,
  silverDiscount: number = DEFAULT_SILVER_DISCOUNT,
  goldDiscount:   number = DEFAULT_GOLD_DISCOUNT,
): number {
  const pct = tier === 'Gold' ? goldDiscount : tier === 'Silver' ? silverDiscount : bronzeDiscount
  const n = Number(pct)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Montant de remise fidélité à appliquer (XOF base) : loyaltyDiscount% sur le total
 * AVANT remise manuelle, puis on plafonne discount total (manuel + fidélité) à
 * MAX_TOTAL_DISCOUNT_PCT pour éviter les abus.
 *
 * Retourne 0 si pas de client, pas de loyaltyOn, discountPct ≤ 0.
 *
 * ⚠️ MIROIR MOBILE : `mobile/src/lib/loyalty.ts` `computeLoyaltyDiscount` DOIT rester
 * identique (le POS mobile calcule le net hors-ligne pour l'affichage + le split). Toute
 * modification de la règle (arrondi, plafond 50 %, remise manuelle) doit être répercutée
 * là-bas. Les cas partagés `docs/shared-fixtures/loyalty-discount-cases.json` (testés des
 * DEUX côtés) font échouer le test en cas de dérive.
 */
export function computeLoyaltyDiscount(
  total: number,
  discountPct: number,        // % remise fidélité du palier
  manualDiscountAmt: number,  // remise manuelle déjà calculée (XOF)
): number {
  if (discountPct <= 0) return 0
  const raw = Math.round(total * discountPct / 100)
  const maxAllowed = Math.round(total * MAX_TOTAL_DISCOUNT_PCT / 100)
  return Math.max(0, Math.min(raw, maxAllowed - manualDiscountAmt))
}

/**
 * Palier d'un solde de points : Bronze < bronzeThreshold, Silver [bronze, silver),
 * Gold ≥ silverThreshold. Seuils configurables par tenant.
 */
export function tierForPoints(
  points: number,
  bronzeThreshold: number = DEFAULT_BRONZE_THRESHOLD,
  silverThreshold: number = DEFAULT_SILVER_THRESHOLD,
): LoyaltyTier {
  const p = Number(points) || 0
  if (p >= silverThreshold) return 'Gold'
  if (p >= bronzeThreshold) return 'Silver'
  return 'Bronze'
}
