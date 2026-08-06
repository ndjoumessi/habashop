import type { MsisdnPolicy } from './msisdn'
import type { Lang } from '@/i18n'

/**
 * POLITIQUE MSISDN PAR FLUX DE PAIEMENT DU POS — et le texte qui la dit au caissier.
 *
 * ─── POURQUOI CE MODULE EXISTE ───────────────────────────────────────────────
 * `POS.tsx` portait une TROISIÈME implémentation de la règle de normalisation, sous le
 * nom `normalizeOrangePhone`, quarante lignes au-dessus de l'appel MTN déjà fusionné —
 * dans le même fichier. Le verrou de point d'appel assertait `calls.length === 1` : il
 * prouvait un site et ne voyait rien du second, parce que celui-ci portait un autre nom.
 *
 * Le vrai défaut n'était pas le doublon. MESURÉ le 2026-08-06 sur 9 saisies :
 *
 *   saisie          POS (avant)     route Campay    verdict
 *   699000001       237699000001    237699000001    ok
 *   699.000.001     null            237699000001    front refuse, serveur acceptait
 *   +221771234567   221771234567    null            front OK  → serveur 400
 *   0612345678      0612345678      null            front OK  → serveur 400
 *   46733123453     46733123453     null            front OK  → serveur 400
 *   799000001       799000001       null            front OK  → serveur 400
 *   12345678        12345678        null            front OK  → serveur 400
 *                                          → 6 divergences sur 9
 *
 * Le champ annonçait « 8–15 chiffres », acceptait un numéro sénégalais, et l'envoyait à
 * `POST /api/payments/campay/request` — route dont la politique EFFECTIVE est `cm-only`
 * (Campay ne dessert que le Cameroun). Le caissier voyait « Échec de la demande », sans
 * jamais apprendre que son numéro était hors périmètre.
 *
 * ⚠️ La politique est MESURÉE sur la route, pas choisie par confort d'affichage. Le
 * message d'aide en est DÉRIVÉ : une réserve écrite deux fois diverge — c'est déjà ce qui
 * était arrivé aux corps de refus de Campay et MTN, alignés le même jour sur
 * `phoneInvalidBody(policy)` côté serveur. Ici, `POS_MSISDN_POLICY` est la source, et
 * l'étiquette comme l'erreur en descendent.
 */

/**
 * Politique appliquée par la ROUTE que chaque flux atteint réellement.
 *
 *  orange → `POST /api/payments/campay/request` · `normalizeMsisdn(…, 'cm-only')`
 *  mtn    → `POST /api/payments/mtn/request`    · `normalizeMsisdn(…, 'international')`
 *
 * ⚠️ Le repli international de MTN n'est pas une négligence : son bac à sable emploie des
 * numéros ÉTRANGERS (46733123453 = Suède). Aplatir les deux casserait un des deux flux.
 */
export const POS_MSISDN_POLICY = {
  orange: 'cm-only',
  mtn:    'international',
} as const satisfies Record<'orange' | 'mtn', MsisdnPolicy>

export type PosPaymentFlow = keyof typeof POS_MSISDN_POLICY

type Quad = Readonly<Record<Lang, string>>

/** Suffixe d'étiquette de champ : ce que la route accepte, en trois mots. */
const FORMAT_LABEL: Record<MsisdnPolicy, Quad> = {
  'cm-only': {
    fr: 'Cameroun',
    en: 'Cameroon',
    es: 'Camerún',
    it: 'Camerun',
  },
  international: {
    fr: '8–15 chiffres',
    en: '8–15 digits',
    es: '8–15 dígitos',
    it: '8–15 cifre',
  },
}

/** Message d'erreur de saisie : dit ce qui manque, jamais « invalide » tout court. */
const ERROR_TEXT: Record<MsisdnPolicy, Quad> = {
  'cm-only': {
    fr: 'Numéro camerounais attendu — Orange Money via Campay ne dessert que le Cameroun',
    en: 'A Cameroonian number is required — Orange Money via Campay only covers Cameroon',
    es: 'Se requiere un número camerunés — Orange Money vía Campay solo cubre Camerún',
    it: 'È richiesto un numero camerunese — Orange Money via Campay copre solo il Camerun',
  },
  international: {
    fr: 'Saisissez un numéro valide (8 à 15 chiffres)',
    en: 'Enter a valid number (8 to 15 digits)',
    es: 'Ingrese un número válido (8 a 15 dígitos)',
    it: 'Inserire un numero valido (da 8 a 15 cifre)',
  },
}

/** Suffixe d'étiquette du champ, dérivé de la politique du flux. */
export function msisdnFormatLabel(flow: PosPaymentFlow, lang: Lang): string {
  return FORMAT_LABEL[POS_MSISDN_POLICY[flow]][lang]
}

/** Erreur de saisie du champ, dérivée de la politique du flux. */
export function msisdnErrorText(flow: PosPaymentFlow, lang: Lang): string {
  return ERROR_TEXT[POS_MSISDN_POLICY[flow]][lang]
}
