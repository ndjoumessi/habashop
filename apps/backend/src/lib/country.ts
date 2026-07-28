/**
 * `Tenant.country` — UNE seule représentation autorisée : le code ISO-3166-1 alpha-2.
 *
 * Pourquoi ce module existe. Le champ contenait en production `SN`, `CI` **et `France`** :
 * `SignupPage` envoyait de l'ISO-2 pendant qu'`Onboarding` PATCHait les LIBELLÉS FRANÇAIS de
 * son propre sélecteur (`value={c}` sur « Sénégal », « Côte d'Ivoire », « France »…). Deux
 * surfaces, deux formats, aucune validation au milieu.
 *
 * Ce n'est pas cosmétique : `resolveRecipient` ne normalise le numéro d'un COMMERÇANT qu'à
 * partir de son pays. Une valeur non ISO-2 est écartée (`COUNTRY_UNKNOWN`), donc un tenant
 * enregistré « France » ne peut recevoir NI WhatsApp NI SMS — silencieusement. Le garde
 * téléphonique fait son travail ; c'est la donnée qui ment.
 *
 * ⚠️ Ce module n'importe PAS `libphonenumber-js` : la bibliothèque est interdite hors du
 * résolveur (`phoneChokepoint.test.ts`), et un second point d'entrée vers elle rouvrirait
 * précisément la porte que ce méta-test ferme.
 */

/**
 * Pays servis par le produit. Volontairement une LISTE BLANCHE et non un `^[A-Z]{2}$` :
 * la regex accepterait `XX` ou `ZZ`, qu'aucune couche avale ne saurait interpréter — on
 * aurait remplacé une valeur invalide bruyante par une valeur invalide silencieuse.
 * Aligné sur `ISO_TO_CURRENCY` (front) : tout pays proposé à l'inscription doit être ici.
 */
export const SUPPORTED_COUNTRIES = [
  // UEMOA (XOF)
  'SN', 'CI', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GW',
  // CEMAC (XAF)
  'CM', 'CG', 'CD', 'CF', 'GA', 'TD', 'GQ',
  // Afrique de l'Ouest hors zone franc
  'GN', 'GH', 'NG',
  // Zone euro + Suisse / Maghreb
  'FR', 'BE', 'DE', 'IT', 'ES', 'NL', 'PT', 'CH', 'MA', 'DZ', 'TN',
  // Amérique du Nord / Royaume-Uni
  'US', 'CA', 'GB',
] as const

export type SupportedCountry = typeof SUPPORTED_COUNTRIES[number]

const SUPPORTED = new Set<string>(SUPPORTED_COUNTRIES)

/**
 * Libellés HÉRITÉS du sélecteur `Onboarding` — ensemble CLOS et connu (ce sont nos propres
 * anciennes `value`), pas une inférence sur du texte libre. C'est ce qui distingue cette
 * table de celles qui ont causé les fuites du chantier téléphonique : là-bas on DEVINAIT le
 * pays d'un numéro inconnu ; ici on traduit des chaînes que nous avons nous-mêmes émises.
 *
 * Conservé parce qu'une PWA en cache continue de PATCHer l'ancien format après le déploiement :
 * refuser sèchement casserait l'onboarding de ces utilisateurs, convertir le répare.
 * « Autre » n'y figure PAS — il ne désigne aucun pays, donc il ne peut rien normaliser.
 */
const LEGACY_FR_LABELS: Record<string, SupportedCountry> = {
  'sénégal': 'SN', 'senegal': 'SN',
  "côte d'ivoire": 'CI', "cote d'ivoire": 'CI',
  'mali': 'ML', 'burkina faso': 'BF', 'guinée': 'GN', 'guinee': 'GN',
  'cameroun': 'CM', 'congo rdc': 'CD', 'gabon': 'GA', 'togo': 'TG',
  'bénin': 'BJ', 'benin': 'BJ', 'niger': 'NE', 'tchad': 'TD',
  'france': 'FR', 'belgique': 'BE', 'canada': 'CA',
}

/**
 * Rend le code ISO-2 canonique, ou `null` si la valeur n'en désigne aucun.
 *
 * `null` signifie « on ne sait pas », JAMAIS un repli implicite. Un défaut silencieux sur
 * `SN` est exactement ce qui a produit la situation actuelle : un tenant ivoirien qui
 * n'ouvre pas la liste est stocké « Sénégal », et plus personne ne peut distinguer un choix
 * d'un défaut. L'appelant décide quoi faire d'un `null` — refuser vaut mieux qu'inventer.
 */
export function normalizeCountry(input: string | null | undefined): SupportedCountry | null {
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!raw) return null
  const upper = raw.toUpperCase()
  if (SUPPORTED.has(upper)) return upper as SupportedCountry
  return LEGACY_FR_LABELS[raw.toLowerCase()] ?? null
}

/** `true` si la valeur est DÉJÀ un ISO-2 servi (sans conversion). */
export function isIsoCountry(input: string | null | undefined): boolean {
  return typeof input === 'string' && SUPPORTED.has(input.trim().toUpperCase()) && input.trim().length === 2
}
