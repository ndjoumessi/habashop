/**
 * JOURS D'ESSAI RESTANTS — RÈGLE CANONIQUE, jumelée avec le frontend.
 *
 * ⚠️ MESURÉ À L'ÉCRAN le 2026-10-01 : l'en-tête de l'application affichait « ESSAI · 14J »
 * et, deux lignes plus bas, le bandeau « 7 jour(s) d'essai restant(s) ». Deux nombres sur le
 * même écran, à propos de la même chose. Le bandeau lisait ce calcul-ci, autoritaire ;
 * la pastille en refaisait un autre côté client, `createdAt + 14 jours`, qui ignorait
 * complètement la colonne `trialEnds`.
 *
 * Les deux ne coïncidaient que par une convention que RIEN n'appliquait — l'inscription pose
 * `trialEnds = now + 14 j`. Toute écriture qui s'en écarte les fait diverger : une démo
 * jetable (7 j), et surtout une ACTIVATION DE PLAN, qui repousse `trialEnds` à 30 ou 365
 * jours (`admin.ts`, `payments.ts`).
 *
 * ⚠️ `trialEnds` ABSENT rend 0, jamais une durée par défaut. Sous-annoncer bruyamment vaut
 * mieux qu'annoncer un essai que la base ne porte pas — même raisonnement que `vatRateOrZero`.
 *
 * Jumeau : `apps/frontend/src/lib/trialDays.ts`, cas partagés
 * `docs/shared-fixtures/trial-days-left.json`.
 */
export const MS_PAR_JOUR = 24 * 60 * 60 * 1000

export function joursDEssaiRestants(trialEnds: Date | string | null | undefined, now: Date): number {
  if (!trialEnds) return 0
  const fin = new Date(trialEnds).getTime()
  if (!Number.isFinite(fin)) return 0
  return Math.max(0, Math.ceil((fin - now.getTime()) / MS_PAR_JOUR))
}
