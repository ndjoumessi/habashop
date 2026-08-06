/**
 * NORMALISATION MSISDN — source unique, côté BACKEND.
 *
 * ⚠️ JUMEAU À L'IDENTIQUE de `apps/frontend/src/lib/msisdn.ts`, exercé contre
 * `docs/shared-fixtures/msisdn-cases.json` (lu à l'EXÉCUTION, jamais importé : le contexte
 * de build Docker du backend est `apps/backend` seul).
 *
 * ─── CE QU'ON FUSIONNE, ET CE QU'ON NE FUSIONNE PAS ──────────────────────────
 * Il existait DEUX fonctions homonymes `normalizeCameroonPhone` : l'une dans `POS.tsx`
 * (flux MTN), l'autre dans `routes/campayPayment.ts` (flux Campay). Mesuré le 2026-08-06 :
 * **8 entrées sur 20 divergeaient**, sur deux axes qu'il fallait distinguer avant de
 * toucher à quoi que ce soit — sinon « fusionner » revenait à choisir au hasard le
 * comportement de l'un des deux appelants.
 *
 *  1. PONCTUATION — accidentel. Le back retirait le POINT et appliquait `trim()`, pas le
 *     front : « 699.000.001 » passait chez l'un, était refusé chez l'autre. On prend le
 *     SUR-ENSEMBLE (le point est retiré partout) : personne ne perd rien, un commerçant
 *     qui tape des points n'est plus rejeté sans raison.
 *
 *  2. PÉRIMÈTRE GÉOGRAPHIQUE — DÉLIBÉRÉ, et c'est pourquoi il reste DEUX politiques.
 *     Le flux MTN accepte 8 à 15 chiffres de n'importe quel pays parce que le bac à sable
 *     MTN utilise des numéros ÉTRANGERS (46733123453 = Suède). Campay ne dessert que le
 *     Cameroun. Aplatir en une seule règle cassait forcément un côté :
 *       • version permissive → Campay expédie un numéro français à une API qui ne sait pas
 *         le traiter, et l'échec est silencieux ;
 *       • version stricte    → le flux de test MTN cesse de fonctionner.
 *     Le paramètre `policy` rend ce choix EXPLICITE au point d'appel, au lieu de le cacher
 *     dans deux fonctions qui portent le même nom.
 *
 * ⚠️ Ne pas ajouter de valeur par défaut à `policy` : le compilateur doit forcer chaque
 * futur appelant à dire quel périmètre il veut — même raisonnement que le paramètre
 * `owner` obligatoire de `resolveRecipient` (cf. § Normalisation téléphonique).
 */

export type MsisdnPolicy =
  /** Cameroun uniquement — Campay ne dessert pas d'autre pays. */
  | 'cm-only'
  /** Tout indicatif, 8 à 15 chiffres — requis par le bac à sable MTN. */
  | 'international'

/** Ponctuation de saisie retirée : espaces, tirets, parenthèses, points. */
const strip = (raw: string): string => raw.trim().replace(/[\s\-().]/g, '')

export function normalizeMsisdn(raw: string, policy: MsisdnPolicy): string | null {
  const s = strip(raw)

  // ── Cameroun, les trois formes acceptées par les deux politiques ──
  if (/^\+237[0-9]{9}$/.test(s)) return s.slice(1)   // +237XXXXXXXXX → 237XXXXXXXXX
  if (/^237[0-9]{9}$/.test(s))   return s            // déjà normalisé
  if (/^6[0-9]{8}$/.test(s))     return `237${s}`    // local 9 chiffres → préfixé

  if (policy === 'cm-only') return null

  // ── Repli international : tout indicatif, 8 à 15 chiffres ──
  const d = s.replace(/^\+/, '')
  return /^[0-9]{8,15}$/.test(d) ? d : null
}
