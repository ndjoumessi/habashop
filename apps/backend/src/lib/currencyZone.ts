/**
 * ZONE FRANC CFA — module SERVEUR, sans jumeau.
 * Cas partagés : `docs/shared-fixtures/currency-zones.json`, lus à l'EXÉCUTION par
 * `src/tests/currencyZone.test.ts`.
 *
 * ⚠️ PAS de jumeau front, et c'est délibéré (2026-08-08). Il en a existé un pendant une
 * journée : rien du produit ne l'importait, seul son propre test l'appelait — un jumeau
 * que personne n'appelle est du code mort, exactement le raisonnement qui a écarté le
 * jumeau mobile de `vatRate`. La règle est SERVEUR-AUTORITAIRE par nature : « la garde du
 * navigateur n'est pas une garde », et la dupliquer côté client n'aurait rien gardé de
 * plus tout en offrant une seconde vérité à faire diverger.
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

import { normalizeCountry } from './country'

/** Les 8 États de l'UMOA — franc CFA BCEAO. */
const UEMOA = ['BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'] as const
/** Les 6 États de la CEMAC — franc CFA BEAC. */
const CEMAC = ['CM', 'CF', 'TD', 'CG', 'GQ', 'GA'] as const

export type CfaZone = 'UEMOA' | 'CEMAC'

/**
 * Zone franc CFA d'un pays, ou `null` s'il n'appartient à aucune des deux.
 *
 * ⚠️ PASSE PAR `normalizeCountry`, et c'est LE point du correctif du 2026-08-08.
 * La première version comparait la chaîne BRUTE aux listes ISO. Or `Tenant.country` a
 * porté des LIBELLÉS français ('Sénégal', 'Cameroun') à côté d'ISO-2 — c'est
 * précisément pourquoi `normalizeCountry` les convertit encore sur les chemins
 * d'écriture. Pour un tenant stocké « Sénégal », `cfaZoneOf` rendait `null`, le conflit
 * n'était pas détecté, et XAF s'écrivait sur une boutique UEMOA : le défaut même que ce
 * module existe pour empêcher, sur le CAS RÉEL plutôt que sur le cas nominal.
 * Les trois autres jugements de pays du dépôt passent par `normalizeCountry` ; celui-ci
 * était le seul à ne pas le faire.
 */
export function cfaZoneOf(country: unknown): CfaZone | null {
  const iso = normalizeCountry(typeof country === 'string' ? country : '')
  if (!iso) return null
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
  // ⚠️ TRIM autant que majuscules : `REGISTER_BODY.currency` et `ADMIN_CREATE_TENANT`
  // sont de simples `z.string().optional()`. Sans trim, `'XAF '` ne correspondait ni à
  // 'XOF' ni à 'XAF' : la fonction rendait `false`, aucun 400, et le tenant était créé
  // SN avec le littéral `'XAF '` — le couple interdit, PLUS un code que ni
  // `CURRENCY_SYMBOLS` ni `TO_XOF_RATES` ne sait résoudre.
  const cur = currency.trim().toUpperCase()
  if (cur !== 'XOF' && cur !== 'XAF') return false
  return cur !== currencyOfZone(zone)
}

/** Message de refus DÉRIVÉ de la zone — écrit à la main, il se périmerait. */
export function currencyZoneError(country: unknown, currency: unknown): string {
  const zone = cfaZoneOf(country)
  const attendue = zone ? currencyOfZone(zone) : '—'
  return `${String(country).toUpperCase()} est en zone ${zone ?? '—'} : la devise attendue est ${attendue}, pas ${String(currency).toUpperCase()}`
}
