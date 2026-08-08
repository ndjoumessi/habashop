/**
 * LOGIQUE PURE DES SÉLECTEURS DE DATE — aucune dépendance React, `now` toujours INJECTÉ.
 *
 * ─── POURQUOI CE MODULE EXISTE SÉPARÉMENT ────────────────────────────────────
 * Le composant rend un calendrier ; c'est ici que vivent les règles qui peuvent être
 * FAUSSES sans qu'on le voie à l'écran : bornes d'un preset, grille d'un mois, ordre
 * d'une plage. Un test sur le DOM rendu ne les distingue pas d'un bug d'affichage.
 *
 * ⚠️ AUCUN `new Date(iso)` SUR UNE DATE SEULE. `new Date('2026-08-08')` est interprété
 * comme MINUIT UTC : à l'ouest de Greenwich, la date locale recule d'un cran (le 08
 * devient le 07). Même piège que `lib/formatDate.ts`, qui découpe la chaîne pour la même
 * raison. Ici on découpe aussi, et on reconstruit avec `new Date(y, m, d)` — constructeur
 * à composantes, donc LOCAL par définition.
 *
 * ⚠️ ET SYMÉTRIQUEMENT, `toISOString().slice(0,10)` EST FAUX pour rendre une date locale :
 * il reconvertit en UTC. À Dakar (UTC+0) c'est sans effet, à Paris en été (UTC+2) le
 * 1er août à 00:00 local devient « 2026-07-31 ». `isoOf` lit les composantes locales.
 */

/** Une date-seule au format `YYYY-MM-DD`, ou `''` quand rien n'est choisi. */
export type IsoDate = string

/** Bornes d'une période, en millisecondes epoch. */
export interface RangeMs { from: number; to: number }

/** Bornes d'une période, en dates-seules ISO. */
export interface RangeIso { from: IsoDate; to: IsoDate }

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Date locale → `YYYY-MM-DD`. Jamais `toISOString()` (cf. en-tête). */
export function isoOf(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/**
 * `YYYY-MM-DD` → `Date` locale à minuit. Rend `null` sur tout le reste — jamais une date
 * par défaut : un repli silencieux ferait porter le filtre sur une période que personne
 * n'a demandée (même raisonnement que `monthKey` en paie, qui rend `null`).
 */
export function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, mo - 1, d)
  // Rejette les dates qui « débordent » (31/02 → 03/03) : le mois doit être celui demandé.
  if (dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}

/** Décale de `n` mois en restant dans le mois visé (31 janv. + 1 mois → 28/29 févr.). */
export function addMonths(d: Date, n: number): Date {
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate()
  const cible = new Date(y, m + n, 1)
  const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate()
  return new Date(cible.getFullYear(), cible.getMonth(), Math.min(day, dernier))
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** Premier / dernier jour du mois de `d`. */
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
export const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

/** Deux dates tombent-elles le même jour civil ? */
export function sameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * GRILLE D'UN MOIS — toujours 42 cases (6 semaines), semaine commençant LUNDI.
 *
 * ⚠️ Six semaines TOUJOURS, même quand cinq suffisent : un calendrier dont la hauteur
 * change au changement de mois fait sauter le panneau sous le curseur, et le bouton
 * « Appliquer » se déplace sous la souris entre deux clics.
 */
export function monthGrid(year: number, monthIndex: number): Date[] {
  const premier = new Date(year, monthIndex, 1)
  // getDay() : 0 = dimanche. On veut lundi = 0.
  const decalage = (premier.getDay() + 6) % 7
  const debut = new Date(year, monthIndex, 1 - decalage)
  return Array.from({ length: 42 }, (_, i) => new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + i))
}

/* ══════════════════════════════════════════════════════════════════════════════
   PRESETS DE PÉRIODE
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * ⚠️ DOMAINE ÉTENDU, et c'est le compilateur qui l'impose ailleurs : `Reports.tsx` porte
 * deux `Record<Period, …>` qui deviennent incomplets tant que les nouvelles valeurs n'y
 * sont pas décrites. C'est la parade recommandée contre l'arité des ternaires — une
 * valeur ajoutée ne peut pas être avalée par un `else`.
 */
export type Period = 'today' | 'yesterday' | '7days' | '30days' | 'thisMonth' | 'lastMonth' | '3months' | 'year'

/** Ordre d'affichage dans le panneau. Source unique — le composant ne réénumère rien. */
export const PERIOD_ORDER: readonly Period[] = [
  'today', 'yesterday', '7days', '30days', 'thisMonth', 'lastMonth', '3months', 'year',
] as const

/**
 * Bornes d'un preset, en DATES-SEULES locales.
 *
 * ⚠️ Bornes ABSOLUES, pas `now - N jours`. L'ancien calcul soustrayait une durée à
 * l'instant courant : « 30 derniers jours » commençait donc à 14 h 32, et une vente
 * enregistrée le matin du 30ᵉ jour tombait HORS période. Le rapport changeait selon
 * l'heure à laquelle on l'ouvrait, sans que rien ne le dise.
 *
 * ⚠️ « 7 derniers jours » INCLUT aujourd'hui : 6 jours en arrière + le jour courant.
 * Écrire 7 en arrière rendrait 8 jours, l'erreur de clôture classique.
 */
export function presetRange(p: Period, now: Date = new Date()): RangeIso {
  const aujourdhui = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const R = (from: Date, to: Date): RangeIso => ({ from: isoOf(from), to: isoOf(to) })

  switch (p) {
    case 'today':     return R(aujourdhui, aujourdhui)
    case 'yesterday': { const h = addDays(aujourdhui, -1); return R(h, h) }
    case '7days':     return R(addDays(aujourdhui, -6), aujourdhui)
    case '30days':    return R(addDays(aujourdhui, -29), aujourdhui)
    case 'thisMonth': return R(startOfMonth(aujourdhui), endOfMonth(aujourdhui))
    case 'lastMonth': { const m = addMonths(startOfMonth(aujourdhui), -1); return R(startOfMonth(m), endOfMonth(m)) }
    case '3months':   return R(addDays(addMonths(aujourdhui, -3), 1), aujourdhui)
    case 'year':      return R(new Date(aujourdhui.getFullYear(), 0, 1), aujourdhui)
  }
}

/**
 * Bornes en millisecondes, minuit → 23:59:59.999 LOCAL.
 *
 * ⚠️ La borne haute est la FIN du jour. Avec `to` à minuit, toute vente de la journée
 * du dernier jour sortait de la période — un rapport « du 1 au 8 » qui ignore le 8.
 */
export function rangeToMs(r: RangeIso): RangeMs | null {
  const f = parseIso(r.from), t = parseIso(r.to)
  if (!f || !t) return null
  const from = f.getTime()
  const to = new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999).getTime()
  return to >= from ? { from, to } : null
}

/**
 * Normalise une sélection en cours : rend toujours `from <= to`.
 * Un utilisateur qui clique le 20 puis le 5 a désigné une plage, pas une erreur.
 */
export function orderRange(a: IsoDate, b: IsoDate): RangeIso {
  const da = parseIso(a), db = parseIso(b)
  if (!da || !db) return { from: a, to: b }
  return da.getTime() <= db.getTime() ? { from: a, to: b } : { from: b, to: a }
}

/** Une date est-elle dans la plage (bornes incluses) ? */
export function inRange(d: Date, r: RangeIso): boolean {
  const f = parseIso(r.from), t = parseIso(r.to)
  if (!f || !t) return false
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return x >= f.getTime() && x <= t.getTime()
}

/** `YYYY-MM` ↔ Date, pour le sélecteur de mois (paie). */
export function parseMonthKey(key: string | null | undefined): Date | null {
  if (!key) return null
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (!m) return null
  const mo = Number(m[2])
  if (mo < 1 || mo > 12) return null
  return new Date(Number(m[1]), mo - 1, 1)
}

export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}
