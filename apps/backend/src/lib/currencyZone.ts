/**
 * ZONE FRANC CFA — jumeau de `apps/frontend/src/lib/currencyZone.ts`.
 * Cas partagés : `docs/shared-fixtures/currency-zones.json` (lus par les tests des DEUX
 * côtés ; déplacer un pays d'un seul côté fait rougir l'autre).
 *
 * ─── POURQUOI, MESURÉ le 2026-08-07 ──────────────────────────────────────────
 * `demo-tenant-001` portait `country = 'SN'` (Sénégal, UEMOA) et `currency = 'XAF'`
 * (Afrique centrale). **Rien ne l'a signalé pendant au moins un jour, et rien ne POUVAIT
 * le signaler** : XOF et XAF ont la même parité (1), zéro décimale et le même symbole
 * affiché — aucun calcul ne les sépare, donc l'erreur est invisible à l'écran.
 * L'écrivain n'a jamais pu être identifié : `PATCH /api/tenant` n'écrit aucun audit.
 * Le correctif n'est donc pas la valeur, c'est ce garde.
 *
 * ⚠️ NE PAS DÉRIVER LA ZONE DU TAUX DE TVA. `vat-rates.json` ne distingue pas les deux
 * zones : GA (CEMAC) porte 18, exactement comme les huit pays UEMOA. Un garde adossé au
 * taux serait juste pour CM et CG, et faux pour GA — une justesse empruntée à une table
 * qui n'a jamais eu pour objet de dire la zone.
 *
 * ⚠️ CE QUE LA RÈGLE INTERDIT, ET RIEN DE PLUS : le MAUVAIS franc CFA. Toute autre devise
 * reste légitime partout — c'est une préférence d'affichage. `e2e-tenant` (SN/EUR) passe
 * donc SANS exemption nommée, et un cas partagé le verrouille : *une exemption dont on n'a
 * pas besoin est un trou qu'on aura oublié d'avoir ouvert.*
 */

/** Les 8 États de l'UMOA — franc CFA BCEAO. */
const UEMOA = ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'] as const
/** Les 6 États de la CEMAC — franc CFA BEAC. */
const CEMAC = ['CM', 'CF', 'TD', 'CG', 'GQ', 'GA'] as const

export type CfaZone = 'UEMOA' | 'CEMAC'

/** Zone franc CFA d'un pays, ou `null` s'il n'appartient à aucune des deux. */
export function cfaZoneOf(country: unknown): CfaZone | null {
  if (typeof country !== 'string' || !country) return null
  const iso = country.toUpperCase()
  if ((UEMOA as readonly string[]).includes(iso)) return 'UEMOA'
  if ((CEMAC as readonly string[]).includes(iso)) return 'CEMAC'
  return null
}

/** La devise attendue dans une zone. */
export function currencyOfZone(zone: CfaZone): 'XOF' | 'XAF' {
  return zone === 'UEMOA' ? 'XOF' : 'XAF'
}

/**
 * `true` si le couple (pays, devise) attribue le MAUVAIS franc CFA.
 * `false` pour tout le reste — y compris un pays hors zone, ou une devise hors franc CFA :
 * non concluant n'est pas innocent, mais ce n'est pas un motif de refus.
 */
export function isCurrencyZoneConflict(country: unknown, currency: unknown): boolean {
  const zone = cfaZoneOf(country)
  if (!zone) return false
  if (typeof currency !== 'string') return false
  const cur = currency.toUpperCase()
  if (cur !== 'XOF' && cur !== 'XAF') return false
  return cur !== currencyOfZone(zone)
}

/** Message de refus DÉRIVÉ de la zone — écrit à la main, il se périmerait. */
export function currencyZoneError(country: unknown, currency: unknown): string {
  const zone = cfaZoneOf(country)
  const attendue = zone ? currencyOfZone(zone) : '—'
  return `${String(country).toUpperCase()} est en zone ${zone ?? '—'} : la devise attendue est ${attendue}, pas ${String(currency).toUpperCase()}`
}
