/**
 * MARCHÉ PAR DÉFAUT — source unique, côté FRONTEND.
 *
 * ⚠️ JUMEAU À L'IDENTIQUE de `apps/backend/src/lib/defaultMarket.ts` et `mobile/src/lib/defaultMarket.ts`, exercé contre
 * `docs/shared-fixtures/default-market.json` (lu à l'EXÉCUTION, jamais importé : le
 * contexte de build Docker du backend est `apps/backend` seul, un import hors de cette
 * frontière casse le déploiement en TS2307 sans que `tsc` local ne le voie).
 *
 * ─── DÉCISION PRODUIT du 2026-08-06 : Cameroun / XAF / +237 ──────────────────
 * MOTIF MESURÉ — les seuls prestataires câblés ET appelables sont camerounais :
 * Campay est en politique `cm-only`, MTN MoMo est camerounais ; Wave est SÉNÉGALAIS et
 * n'a aucune clé (son checkout rend 422), Orange non plus. Un commerçant qui s'inscrivait
 * avec les valeurs par défaut obtenait SN + XOF, puis se voyait proposer le seul chemin
 * de paiement qui ne fonctionne pas.
 *
 * ⚠️ XOF → XAF n'a AUCUN effet sur les montants : les deux sont à parité 1, à 0 décimale,
 * et partagent le symbole « FCFA ». `lib/plans.ts` ne dépend pas du code de devise.
 *
 * ⚠️ CE MODULE NE DÉCRIT QUE LE DÉFAUT — ce qu'obtient une boutique quand personne n'a
 * choisi. Il ne touche à AUCUN tenant existant, et il ne remplace PAS les replis
 * d'affichage `tenant.currency ?? 'XOF'` : ceux-là rendent une devise absente, ils ne
 * décident pas d'un marché. Décision explicite du 2026-08-06 : on les laisse.
 */

/**
 * ⚠️ Champs typés `string`, PAS `as const`. Avec `as const`, `country` valait le type
 * littéral `'CM'` : tout état de formulaire initialisé depuis lui se retrouvait figé sur
 * cette seule valeur, et le champ pays devenait inéditable au sens du compilateur. Un
 * défaut doit être une VALEUR de départ, pas une contrainte de type.
 */
export const DEFAULT_MARKET: { country: string; currency: string; dialCode: string; flag: string } = {
  /** Pays ISO-2 attribué à une boutique neuve. Doit être dans `SUPPORTED_COUNTRIES`. */
  country: 'CM',
  /** Devise attribuée à une boutique neuve. */
  currency: 'XAF',
  /**
   * Indicatif de REPLI — jamais une constante d'affichage.
   * L'indicatif proposé au caissier se dérive de `tenant.country` (cf. `dialCodeFor`) ;
   * celui-ci ne sert que si le pays du tenant est absent ou inconnu.
   */
  dialCode: '+237',
  flag: '🇨🇲',
}

export type DefaultMarket = typeof DEFAULT_MARKET

/**
 * Indicatif téléphonique par PAYS — sur les marchés servis.
 *
 * ⚠️ Ce n'est PAS une inférence de pays depuis un numéro : c'est l'inverse, on part d'un
 * pays CONNU (celui du tenant, choisi à l'inscription) pour proposer un préfixe. La
 * distinction est celle qui a coûté trois fuites au chantier téléphonique — deviner le
 * pays d'un numéro est interdit, proposer le préfixe d'un pays déclaré ne l'est pas.
 * `resolveRecipient` reste seul juge de ce qui part réellement.
 */
const DIAL_BY_COUNTRY: Record<string, string> = {
  // CEMAC (XAF)
  CM: '+237', CG: '+242', CD: '+243', CF: '+236', GA: '+241', TD: '+235', GQ: '+240',
  // UEMOA (XOF)
  SN: '+221', CI: '+225', ML: '+223', BF: '+226', NE: '+227', TG: '+228', BJ: '+229', GW: '+245',
  // Afrique de l'Ouest hors zone franc
  GN: '+224', GH: '+233', NG: '+234',
  // Europe / Maghreb / Amérique du Nord
  FR: '+33', BE: '+32', DE: '+49', IT: '+39', ES: '+34', NL: '+31', PT: '+351', CH: '+41',
  MA: '+212', DZ: '+213', TN: '+216', US: '+1', CA: '+1', GB: '+44',
}

/**
 * Indicatif à PROPOSER pour un pays donné.
 * Un pays absent ou inconnu retombe sur le marché par défaut — jamais sur un pays tiers.
 */
export function dialCodeFor(country: unknown): string {
  // ⚠️ `unknown`, pas `string | null` : `country` vient d'un JSON d'API et d'un store
  // persisté. Le typer `string` est une AFFIRMATION, pas une garantie — un objet y est
  // arrivé en test et a fait lever `.toUpperCase()`. Même raisonnement que
  // `resolvePlanId(raw: unknown)` du catalogue de plans : à la frontière, on vérifie.
  if (typeof country !== 'string' || !country) return DEFAULT_MARKET.dialCode
  return DIAL_BY_COUNTRY[country.toUpperCase()] ?? DEFAULT_MARKET.dialCode
}

/** Pays connu du module ? Utile pour distinguer « absent » de « non servi ». */
export function hasDialCode(country: unknown): boolean {
  return typeof country === 'string' && country.toUpperCase() in DIAL_BY_COUNTRY
}
