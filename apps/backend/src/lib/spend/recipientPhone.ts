import { parsePhoneNumberFromString, isSupportedCountry, type CountryCode } from 'libphonenumber-js'

/**
 * Résolution du destinataire en E.164 — fonction PURE, seule autorité.
 *
 * ⚠️ Quatre tentatives de normalisation ont été annulées ici, chacune ayant fabriqué
 * un numéro VALIDE d'un autre pays puis l'ayant fait LIVRER (cf. § Chantier
 * NORMALISATION du CLAUDE.md). Le correctif n'est pas « une meilleure bibliothèque »
 * mais une question posée avant elle : À QUI APPARTIENT CE NUMÉRO ?
 *
 *   • Numéro du COMMERÇANT (`ownerPhone`, crons) — son numéro, son pays. Normalisable
 *     avec `tenant.country`, à condition que ce soit un ISO-2 RECONNU : la prod contient
 *     déjà « France » écrit par l'onboarding, et le défaut 'SN' est silencieux.
 *   • Numéro d'un CLIENT (reçu, diffusion, campagne) — `Customer` n'a AUCUN champ pays.
 *     Rien ne permet de deviner sa région, donc ON NE DEVINE PAS : on exige un
 *     international explicite, sinon on REFUSE.
 *
 * Faits MESURÉS (libphonenumber-js 1.13.9) qui interdisent toute inférence :
 *   • `621234567` est valide en CM (+237) ET en GN (+224) ; `76123456` l'est dans CINQ
 *     pays (ML, BF, NE, TG, GA). `isValid()` ne sépare que des plans DISJOINTS.
 *   • Coller un `+` n'est pas syntaxique : `+621234567` est un numéro INDONÉSIEN valide,
 *     donc livrable. « On ne transforme pas » ne vaut JAMAIS « on n'envoie pas ».
 *   • `parsePhoneNumberFromString('0701234567','SN')` renvoie un objet NON NUL dont
 *     `.number` vaut `+2210701234567` — seul `isValid()` l'écarte. La bibliothèque
 *     FABRIQUE ; c'est le gate `isValid()` qui protège, pas la bibliothèque.
 */

/**
 * À qui appartient le numéro. Union DISCRIMINÉE et paramètre OBLIGATOIRE : le
 * compilateur force chaque appelant — présent et futur — à le déclarer. Un site qui
 * oublie ne compile pas, au lieu de retomber silencieusement sur un défaut permissif.
 */
export type PhoneOwner =
  | { kind: 'merchant'; country?: string | null }
  | { kind: 'customer' }

export type PhoneRefusal =
  /** Flux client : le numéro n'est pas un international explicite. */
  | 'PHONE_NOT_INTERNATIONAL'
  /** Flux commerçant : `tenant.country` n'est pas un ISO-2 reconnu. */
  | 'COUNTRY_UNKNOWN'
  /** Le numéro ne forme pas un E.164 valide, même avec un pays légitime. */
  | 'PHONE_INVALID'
  | 'PHONE_EMPTY'

/**
 * Discriminant TEXTUEL (`status`) et non booléen : sous `strict:false` — l'état actuel
 * du tsconfig — le rétrécissement d'une union à discriminant `ok: true | false` ne se
 * fait pas, et `r.reason` ne compile pas. Un tag string narrow dans tous les modes.
 */
export type PhoneResolution =
  | { status: 'resolved'; e164: string }
  | { status: 'refused'; reason: PhoneRefusal }

/**
 * Nettoyage COSMÉTIQUE uniquement : espaces, tirets, points, parenthèses.
 * N'ajoute, ne retire et ne réordonne AUCUN chiffre — en particulier, ne touche ni
 * au zéro de tête (conservé par CI/BJ/CG, retiré par GA : aucune règle uniforme) ni
 * au préfixe `00` (le réécrire en `+` suppose un indicatif pays derrière).
 */
function stripCosmetic(raw: string): string {
  return raw.replace(/[\s\-.()]/g, '')
}

/** Parse un international EXPLICITE (`+…`) sans jamais consulter de pays. */
function parseExplicitInternational(cleaned: string): PhoneResolution {
  if (!cleaned.startsWith('+')) return { status: 'refused', reason: 'PHONE_NOT_INTERNATIONAL' }
  const parsed = parsePhoneNumberFromString(cleaned)
  // `parsed` non nul ne suffit PAS — la bibliothèque fabrique. Seul isValid() tranche.
  if (!parsed?.isValid()) return { status: 'refused', reason: 'PHONE_INVALID' }
  return { status: 'resolved', e164: parsed.number }
}

/**
 * Résout un numéro brut en E.164, ou REFUSE.
 *
 * Le refus est le comportement sûr : un message non envoyé est bénin, un message au
 * MAUVAIS destinataire est une fuite. Aucun chemin ne renvoie un `+` deviné.
 */
export function resolveRecipient(raw: string | null | undefined, owner: PhoneOwner): PhoneResolution {
  const cleaned = stripCosmetic(String(raw ?? '').trim())
  if (!cleaned) return { status: 'refused', reason: 'PHONE_EMPTY' }

  // ── Flux CLIENT : aucun pays n'est consultable, donc aucun n'est consulté. ──
  if (owner.kind === 'customer') return parseExplicitInternational(cleaned)

  // ── Flux COMMERÇANT : son numéro, son pays. ──
  // Déjà international → le pays devient inutile, on ne le consulte pas.
  if (cleaned.startsWith('+')) return parseExplicitInternational(cleaned)

  const country = (owner.country ?? '').trim().toUpperCase()
  // `isSupportedCountry` écarte « France », '' et le défaut silencieux mal renseigné.
  if (!isSupportedCountry(country)) return { status: 'refused', reason: 'COUNTRY_UNKNOWN' }

  const parsed = parsePhoneNumberFromString(cleaned, country as CountryCode)
  if (!parsed?.isValid()) return { status: 'refused', reason: 'PHONE_INVALID' }
  return { status: 'resolved', e164: parsed.number }
}
