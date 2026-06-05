// Fidélité — règle de gain et paliers (fonctions PURES, testables sans DB).
// Configurable PAR TENANT : pointsPerAmount + seuils bronze/silver passés en
// paramètres. Les défauts reproduisent le comportement v1 (1000 / 2000 / 5000).

export const DEFAULT_POINTS_PER_UNIT = 1000
export const DEFAULT_BRONZE_THRESHOLD = 2000  // pts : seuil Bronze → Silver
export const DEFAULT_SILVER_THRESHOLD = 5000  // pts : seuil Silver → Gold

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
