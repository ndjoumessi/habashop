// Fidélité v1 — règle de gain et paliers (fonctions PURES, testables sans DB).
// Décisions figées : 1 point / 1000 (XOF/XAF base), FORFAITAIRE, sur le montant
// payé TTC après remise, arrondi au PLANCHER. Paliers = STATUT seulement (pas de
// remise/échange en v1).

export const POINTS_PER_UNIT = 1000

export const LOYALTY_TIERS = {
  silver: 2000,
  gold: 5000,
} as const

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold'

/** Points gagnés pour un montant payé (TTC, après remise). floor(montant / 1000). */
export function pointsForAmount(amountPaid: number): number {
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) return 0
  return Math.floor(amountPaid / POINTS_PER_UNIT)
}

/** Palier d'un solde de points : Bronze <2000, Silver 2000–4999, Gold ≥5000. */
export function tierForPoints(points: number): LoyaltyTier {
  const p = Number(points) || 0
  if (p >= LOYALTY_TIERS.gold) return 'Gold'
  if (p >= LOYALTY_TIERS.silver) return 'Silver'
  return 'Bronze'
}
