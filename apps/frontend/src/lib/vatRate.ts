/**
 * TAUX DE TVA STANDARD PAR PAYS — jumeau de `apps/backend/src/lib/vatRate.ts`.
 * Cas partagés : `docs/shared-fixtures/vat-rates.json` (lus par les tests des DEUX côtés ;
 * modifier un taux d'un seul côté fait rougir l'autre).
 *
 * ─── POURQUOI, MESURÉ le 2026-08-06 ──────────────────────────────────────────
 * Il n'existait AUCUN mapping pays → TVA. Le taux venait d'un `@default(18)` du schéma
 * Prisma, et **aucun** des trois chemins de création de tenant n'écrivait `vatRate` :
 * `POST /auth/register`, `POST /api/tenant`, `POST /api/admin/tenants`. Or 18 % est le taux
 * UEMOA. Depuis que le marché par défaut est le Cameroun (2026-08-06), toute inscription
 * camerounaise recevait donc **18 % au lieu de 19,25 %** — silencieusement, sur des factures.
 *
 * ⚠️ CE MODULE NE DIT PAS LE DROIT, il propose une VALEUR DE DÉPART. Le taux reste éditable
 * par le commerçant (Réglages → POS). Un pays absent de la table rend **`null`**, jamais un
 * taux inventé : le commerçant le saisit, et un champ vide se voit — un taux faux ne se voit
 * pas. Même raisonnement que `ratingSummary` qui rend `null` plutôt qu'une note moyenne
 * fabriquée, et que `resolvePosPayMode` qui ne devine pas un prestataire.
 *
 * ⚠️ LE TAUX STANDARD N'EST PAS LE TAUX DE CHAQUE PRODUIT. Au Cameroun, les produits
 * alimentaires de base sont EXONÉRÉS : une supérette n'applique pas 19,25 % sur l'essentiel
 * de son catalogue. Le produit ne modélise pas la TVA par ligne (un seul `tenant.vatRate`) —
 * limite ASSUMÉE et écrite ici, plutôt que masquée par un chiffre qui aurait l'air précis.
 */

/**
 * ⚠️ Table volontairement INCOMPLÈTE : 11 pays documentés sur les 29 de
 * `SUPPORTED_COUNTRIES`. On n'inscrit que les taux SOURCÉS (cf. la fixture). Compléter au
 * jugé reviendrait à écrire du droit fiscal de mémoire — ajouter un pays impose d'en citer
 * la source dans `docs/shared-fixtures/vat-rates.json`.
 */
const VAT_BY_COUNTRY: Record<string, number> = {
  // UEMOA — directive d'harmonisation, taux standard 18 %.
  SN: 18, CI: 18, ML: 18, BF: 18, NE: 18, TG: 18, BJ: 18, GW: 18,
  // CEMAC — ⚠️ PAS homogène, contrairement à l'UEMOA : trois taux distincts.
  CM: 19.25,   // 17,5 % + 10 % de centimes additionnels communaux
  GA: 18,
  CG: 18.9,    // 18 % + 5 % de surtaxe
  // Europe — présent parce qu'un tenant de production est en FR.
  FR: 20,
}

/**
 * Taux de TVA standard à PROPOSER pour un pays donné, ou `null` s'il n'est pas documenté.
 *
 * ⚠️ `country: unknown` et non `string` : la valeur vient d'un corps de requête et d'une
 * colonne de base. La typer serait une AFFIRMATION, pas une garantie — même raison que
 * `dialCodeFor(unknown)` et `resolvePlanId(unknown)`.
 *
 * ⚠️ Rend `null`, PAS un taux de repli. Il n'existe pas de « taux par défaut » raisonnable :
 * 18 était précisément le repli qui a produit le défaut. Les appelants décident quoi faire
 * d'une absence — et `vatRateOrZero` ci-dessous rend ce choix explicite.
 */
export function vatRateFor(country: unknown): number | null {
  if (typeof country !== 'string') return null
  const iso = country.trim().toUpperCase()
  return VAT_BY_COUNTRY[iso] ?? null
}

/**
 * Valeur à ÉCRIRE en base à la création d'un tenant.
 *
 * ⚠️ `Tenant.vatRate` est NON NULLABLE : il faut bien écrire un nombre. Quand le pays n'est
 * pas documenté on écrit **0**, jamais 18 ni le taux du marché par défaut :
 *   • 0 se voit immédiatement à l'écran (le POS n'affiche aucune TVA) → le commerçant le
 *     corrige au premier encaissement ;
 *   • un taux non nul mais faux est INVISIBLE et part sur des factures.
 * Sous-facturer bruyamment vaut mieux que facturer faux en silence.
 */
export function vatRateOrZero(country: unknown): number {
  return vatRateFor(country) ?? 0
}

/** Pays pour lesquels un taux est documenté — sert aux tests et à l'assertion de couverture. */
export const VAT_DOCUMENTED_COUNTRIES = Object.keys(VAT_BY_COUNTRY)
