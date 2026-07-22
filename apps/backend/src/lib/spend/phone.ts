/**
 * Normalisation E.164 des numéros WhatsApp — RÈGLE UNIQUE.
 *
 * ⚠️ Avant ce module, `broadcast` et `campaign` normalisaient DIFFÉREMMENT, et aucun
 * des deux ne produisait un numéro valide à partir d'un format national :
 *  • l'ancienne boucle faisait `'+' + p.replace(/^0/, '')` → « 077 123 45 67 » devenait
 *    `+771234567` : le zéro sautait, mais l'indicatif pays manquait toujours ;
 *  • le client unifié ne gérait que le préfixe `00` → `+0771234567`, tout aussi rejeté
 *    (Twilio 21211).
 * Les deux étaient faux, différemment. On résout ici avec le PAYS de la boutique.
 */

/**
 * Indicatif + traitement du zéro de tête, par pays (cf. COUNTRIES côté frontend).
 *
 * ⚠️ `trunkZero` n'est PAS uniforme, et s'en remettre à une règle unique produit des
 * numéros invalides :
 *  • `true`  → le 0 initial est un préfixe national à RETIRER (France : 06… → +336…) ;
 *  • `false` → le 0 fait PARTIE du numéro et doit être CONSERVÉ. C'est le cas de la
 *    Côte d'Ivoire depuis le passage à 10 chiffres en 2021 (07 12 34 56 78 →
 *    +225 07 12 34 56 78) et du Bénin depuis l'ajout du préfixe 01 en 2022.
 *    Retirer le zéro pour ces pays casse tous leurs numéros.
 */
export const COUNTRY_PHONE: Record<string, { dial: string; trunkZero: boolean }> = {
  SN: { dial: '221', trunkZero: true },  CI: { dial: '225', trunkZero: false },
  ML: { dial: '223', trunkZero: true },  BF: { dial: '226', trunkZero: true },
  CM: { dial: '237', trunkZero: true },  CG: { dial: '242', trunkZero: true },
  CD: { dial: '243', trunkZero: true },  GA: { dial: '241', trunkZero: true },
  NE: { dial: '227', trunkZero: true },  TG: { dial: '228', trunkZero: true },
  BJ: { dial: '229', trunkZero: false }, GN: { dial: '224', trunkZero: true },
  GH: { dial: '233', trunkZero: true },  NG: { dial: '234', trunkZero: true },
  MA: { dial: '212', trunkZero: true },  DZ: { dial: '213', trunkZero: true },
  TN: { dial: '216', trunkZero: true },  KE: { dial: '254', trunkZero: true },
  FR: { dial: '33',  trunkZero: true },  BE: { dial: '32',  trunkZero: true },
  CH: { dial: '41',  trunkZero: true },  ES: { dial: '34',  trunkZero: false },
  IT: { dial: '39',  trunkZero: false }, CA: { dial: '1',   trunkZero: true },
  US: { dial: '1',   trunkZero: true },  GB: { dial: '44',  trunkZero: true },
}

/** Indicatifs seuls — conservé pour la lisibilité des appelants. */
export const DIAL_CODES: Record<string, string> =
  Object.fromEntries(Object.entries(COUNTRY_PHONE).map(([k, v]) => [k, v.dial]))

/**
 * Rend un numéro au format E.164 (`+221771234567`), ou `null` s'il est inexploitable.
 *
 * @param raw      numéro tel que saisi/stocké (espaces, tirets, parenthèses tolérés)
 * @param country  code ISO-2 de la boutique (`Tenant.country`) — sert d'indicatif par
 *                 défaut quand le numéro est en format national.
 */
export function toE164(raw: string | null | undefined, country = 'SN'): string | null {
  if (!raw) return null
  let n = String(raw).replace(/[\s\-().]/g, '')
  if (!n) return null

  n = n.replace(/^whatsapp:/i, '')
  if (n.startsWith('00')) n = '+' + n.slice(2)   // préfixe international composé

  const cfg = COUNTRY_PHONE[String(country).toUpperCase()] ?? COUNTRY_PHONE.SN
  const dial = cfg.dial

  if (n.startsWith('+')) {
    const digits = n.slice(1).replace(/\D/g, '')
    return digits.length >= 8 ? '+' + digits : null
  }

  const digits = n.replace(/\D/g, '')
  if (!digits) return null

  // Zéro de tête : retiré SEULEMENT dans les pays où c'est un préfixe national.
  // En CI/BJ (et IT/ES) il appartient au numéro — le retirer casserait l'abonné.
  if (digits.startsWith('0')) {
    return cfg.trunkZero ? `+${dial}${digits.replace(/^0+/, '')}` : `+${dial}${digits}`
  }

  // Déjà préfixé par l'indicatif pays (sans « + ») → on ajoute juste le « + ».
  if (digits.startsWith(dial)) return `+${digits}`

  // Numéro national sans zéro de tête.
  return `+${dial}${digits}`
}

/** Forme `whatsapp:+221…` attendue par Twilio, ou `null` si le numéro est inexploitable. */
export function toWhatsAppAddress(raw: string | null | undefined, country = 'SN'): string | null {
  const e164 = toE164(raw, country)
  return e164 ? `whatsapp:${e164}` : null
}

/**
 * Masque un numéro pour les journaux : `+221771234567` → `+221****4567`.
 * ⚠️ CLAUDE.md : les numéros de téléphone ne doivent JAMAIS atteindre les logs Railway.
 * Les messages d'erreur Twilio contiennent le numéro destinataire — d'où ce masquage
 * appliqué à TOUT ce qui est journalisé par le client d'envoi.
 */
export function maskPhone(value: string): string {
  return String(value).replace(/\+?\d[\d\s\-().]{6,}\d/g, m => {
    const digits = m.replace(/\D/g, '')
    const head = digits.slice(0, 3)
    const tail = digits.slice(-4)
    return `+${head}****${tail}`
  })
}
