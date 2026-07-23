import { parsePhoneNumberFromString, isSupportedCountry, type CountryCode } from 'libphonenumber-js'

/**
 * Normalisation E.164 d'un numéro — fonction PURE, ne throw jamais.
 *
 * ⚠️ HISTORIQUE — une première tentative (`lib/spend/phone.ts`, annulée par `1ae8f9c0`)
 * a livré des reçus de commerçants à des INCONNUS : un numéro sans pays identifiable
 * était réécrit en numéro sénégalais VALIDE, donc effectivement distribué par Twilio.
 * Avant elle, Twilio rejetait ces numéros (erreur 21211) et rien ne partait.
 *
 * D'où l'invariant qui gouverne tout ce fichier :
 *
 *   ┌─ Pays inconnu OU absent → on NE normalise PAS. Jamais de repli sur un pays
 *   │  par défaut, et surtout pas le Sénégal. En cas de doute on rend le numéro
 *   └─ INCHANGÉ : Twilio rejettera un numéro mal formé, ce qui est l'issue SÛRE.
 *
 * Un message non envoyé est un incident bénin ; un message envoyé au mauvais
 * destinataire est une fuite de données. L'asymétrie n'est pas discutable.
 *
 * ⚠️ CE QUI PROTÈGE ICI, C'EST `isValid()`, PAS LE PAYS. Mesuré, pas supposé :
 * `parsePhoneNumberFromString('0701234567', 'SN')` — un numéro national IVOIRIEN
 * attribué au Sénégal — renvoie un objet NON NUL dont `.number` vaut `+2210701234567`.
 * La bibliothèque FABRIQUE donc bien le numéro sénégalais ; seul `isValid()` (faux ici,
 * la longueur ne correspond à aucun plan SN) l'écarte. Renvoyer `.number` sans exiger
 * `isValid()` rejouerait la fuite d'origine à l'identique.
 * Verrou : `phoneE164.test.ts` › « ANTI-FUITE ».
 *
 * Pourquoi une bibliothèque et pas une table : la tentative annulée écrivait à la main
 * le traitement du zéro de tête, et se trompait pour CG et GA. Le zéro n'est PAS
 * uniforme — CI/BJ/CG le CONSERVENT (`061234567` → `+242061234567`), GA le RETIRE
 * (`062345678` → `+24162345678`). Ces plans de numérotation changent ; les maintenir
 * à la main est une dette qui se paie en messages mal adressés.
 */

export type NormalizedPhone = {
  /** Numéro à utiliser. Identique à l'entrée quand `normalized` est faux. */
  value: string
  /** true UNIQUEMENT si un E.164 valide a été produit. */
  normalized: boolean
}

/**
 * Numéro d'un TIERS (client du commerçant) : aucune inférence de pays, jamais.
 *
 * ⚠️ POURQUOI UNE FONCTION SÉPARÉE — c'est la leçon de la revue du commit 18cc6eb9.
 * `normalizePhone(raw, tenant.country)` était appliqué aux numéros des CLIENTS, alors
 * que le pays du commerçant n'est PAS une information sur son client. Mesuré :
 * `621234567` est valide en CM (`+237621234567`) ET en GN (`+224621234567`) ;
 * `76123456` est valide simultanément en ML, BF, NE et TG. Chez un commerçant
 * camerounais, le numéro national d'une cliente guinéenne devenait donc un
 * `+237…` VALIDE — un abonné camerounais sans aucun lien — et Twilio le livrait.
 * `isValid()` ne protège que des plans DISJOINTS ; il ne voit pas une collision.
 *
 * `Customer` n'a d'ailleurs aucun champ pays : il n'existe aucune donnée permettant
 * de résoudre un numéro national de client. La seule issue sûre est d'EXIGER
 * l'international et, à défaut, de ne pas envoyer.
 */
export function requireInternational(raw: unknown): NormalizedPhone {
  const input = typeof raw === 'string' ? raw : String(raw ?? '')
  const unchanged: NormalizedPhone = { value: input, normalized: false }

  // `00` → `+` est la convention IDD universelle, une réécriture PUREMENT syntaxique :
  // elle ne suppose aucun pays (l'indicatif suit dans le numéro lui-même). C'est la
  // seule transformation tolérée ici.
  const trimmed = input.trim().replace(/^00/, '+')
  if (!trimmed.startsWith('+')) return unchanged

  try {
    const parsed = parsePhoneNumberFromString(trimmed)
    if (!parsed || !parsed.isValid()) return unchanged
    return { value: parsed.number, normalized: true }
  } catch {
    return unchanged
  }
}

/** Le pays n'est retenu que si la bibliothèque le reconnaît comme région ISO-2.
 *
 *  ⚠️ Volontairement AUCUNE table nom→code : `Tenant.country` contient un mélange
 *  d'ISO-2 et de noms français (constaté en prod : « CI », « SN », « France ») parce
 *  qu'`Onboarding.tsx` envoie des noms là où `SignupPage.tsx` envoie des codes. Une
 *  table de correspondance écrite à la main est exactement ce qui a échoué la
 *  première fois. Un nom non reconnu ⇒ pays inconnu ⇒ pas de normalisation : la
 *  dégradation va dans le sens sûr, et ces tenants ont déjà des numéros
 *  internationaux (que la branche `+` traite sans pays). */
function resolveRegion(country: unknown): CountryCode | undefined {
  if (typeof country !== 'string') return undefined
  const c = country.trim().toUpperCase()
  // `isSupportedCountry` est le garde de type : rien d'autre ne devient un CountryCode.
  return c.length === 2 && isSupportedCountry(c) ? (c as CountryCode) : undefined
}

/**
 * Numéro du COMMERÇANT LUI-MÊME (`Tenant.ownerPhone`), résolu avec le pays de SA
 * boutique — le seul cas où le pays du tenant est une information sur le titulaire
 * du numéro.
 *
 * ⚠️ NE JAMAIS APPELER sur le numéro d'un client : utiliser `requireInternational`.
 * Voir l'explication de la collision de plans dans son commentaire.
 *
 * `('771234567', 'SN')` → `{ value: '+221771234567', normalized: true }`
 * `('0701234567', 'SN')` → `{ value: '0701234567', normalized: false }` (ivoirien : INCHANGÉ)
 *
 * @param raw     numéro tel que saisi/stocké
 * @param country code pays du tenant, éventuellement absent ou non reconnu
 */
export function normalizePhone(raw: unknown, country?: unknown): NormalizedPhone {
  const input = typeof raw === 'string' ? raw : String(raw ?? '')
  const unchanged: NormalizedPhone = { value: input, normalized: false }

  const trimmed = input.trim()
  if (!trimmed) return unchanged

  // Déjà international : le pays est ignoré, le numéro se suffit à lui-même.
  // Sinon un pays FAUX (défaut « SN » silencieux) primerait sur un préfixe explicite.
  const isInternational = trimmed.startsWith('+')
  const region = isInternational ? undefined : resolveRegion(country)

  // Format national SANS pays exploitable → on ne devine pas. C'EST l'invariant.
  if (!isInternational && !region) return unchanged

  try {
    const parsed = parsePhoneNumberFromString(trimmed, region)
    // `!parsed` : chaîne inexploitable. `!isValid()` : la bibliothèque a bien produit un
    // E.164 mais il ne correspond à aucun plan réel de cette région — cf. le cas ivoirien
    // ci-dessus, seul rempart contre la fuite.
    if (!parsed || !parsed.isValid()) return unchanged
    return { value: parsed.number, normalized: true }
  } catch {
    return unchanged // ne throw JAMAIS : un envoi ne doit pas échouer sur un numéro douteux
  }
}
