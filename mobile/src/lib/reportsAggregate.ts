// Agrégats de l'écran Rapports — fonctions PURES, donc testables hors React.
//
// ⚠️ POURQUOI ce fichier existe : l'écran calculait le graphe et le KPI « Meilleure
// journée » sur les **7 derniers jours calendaires** (`Math.min(periodDays, 7)`) alors que
// CA / Transactions / Panier moyen portaient sur TOUTE la période. Sous « 90 jours »,
// l'écran affichait donc deux fenêtres différentes sans le dire — un panier moyen de
// 52,83 € à côté d'une « meilleure journée » à 2,90 €. Ces deux fonctions reçoivent le
// tableau DÉJÀ filtré par la période et n'en refenêtrent aucun sous-ensemble.
//
// ⚠️ MONNAIE : les `total` sont en **XOF** (base DB, cf. entête CSV `total_XOF`). On somme
// des XOF bruts ; la conversion vers la devise du tenant est faite UNE seule fois, à
// l'affichage, par `fmt()`/`formatAmount`. Ne jamais convertir en amont d'ici.

/** Forme minimale consommée — évite de dépendre de `SaleRecord` entier dans les tests. */
export interface SaleLike {
  total?: number | null
  createdAt: string | number | Date
}

export interface WeekdayBucket {
  /** Abréviation localisée, ex. « Sam ». */
  label: string
  /** Index `Date.getDay()` : 0 = dimanche. */
  weekday: number
  /** Somme des `total` en XOF. */
  value: number
}

export interface CalendarDay {
  /** Clé calendaire LOCALE `YYYY-MM-DD` (pas UTC — cf. `localDateKey`). */
  dateISO: string
  /** Somme des `total` en XOF de cette journée. */
  value: number
}

// Abréviations en dur : Hermes/Android ignore les options de `toLocaleDateString`.
export const WEEKDAY_LABELS: Record<string, string[]> = {
  fr: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  it: ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'],
}

export const MONTH_LABELS: Record<string, string[]> = {
  fr: ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  it: ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'],
}

/**
 * Ordre d'affichage : lundi → dimanche, identique dans les 4 langues.
 * Les index sont ceux de `Date.getDay()` (0 = dimanche), d'où ce tableau plutôt qu'un
 * simple `0..6` : c'est la seule chose qui distingue « ordre d'affichage » de « index JS ».
 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

function toDate(value: SaleLike['createdAt']): Date | null {
  const d = value instanceof Date ? value : new Date(value)
  return isNaN(+d) ? null : d
}

/**
 * Clé calendaire dans le fuseau LOCAL. ⚠️ Pas `toISOString().slice(0,10)` : celui-ci rend
 * la date UTC, donc une vente de 23 h à Dakar (UTC+0, mais UTC+1 ailleurs) tomberait le
 * lendemain. La journée d'un commerçant est celle de son téléphone.
 */
export function localDateKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * CA agrégé par JOUR DE SEMAINE sur TOUT le tableau reçu (aucun refenêtrage).
 * Rend toujours 7 entrées, lundi → dimanche, jours sans vente inclus (value 0) — sinon le
 * graphe changerait de nombre de barres selon les données.
 */
export function salesByWeekday(sales: SaleLike[], lang: string): WeekdayBucket[] {
  const labels = WEEKDAY_LABELS[lang] ?? WEEKDAY_LABELS.fr
  const totals = [0, 0, 0, 0, 0, 0, 0]

  for (const s of sales) {
    const d = toDate(s.createdAt)
    if (!d) continue
    totals[d.getDay()] += s.total ?? 0
  }

  return WEEK_ORDER.map(w => ({ label: labels[w], weekday: w, value: totals[w] }))
}

/**
 * Journée CALENDAIRE (une date précise, pas un jour de semaine) au CA le plus élevé.
 * Rend `null` sur un tableau vide ou sans date exploitable — jamais un jour à 0 inventé.
 * Égalité : la première date rencontrée gagne (comparaison stricte `>`).
 */
export function bestCalendarDay(sales: SaleLike[]): CalendarDay | null {
  const byDate = new Map<string, number>()

  for (const s of sales) {
    const d = toDate(s.createdAt)
    if (!d) continue
    const key = localDateKey(d)
    byDate.set(key, (byDate.get(key) ?? 0) + (s.total ?? 0))
  }

  let best: CalendarDay | null = null
  for (const [dateISO, value] of byDate) {
    if (!best || value > best.value) best = { dateISO, value }
  }
  return best
}

/**
 * `YYYY-MM-DD` → « Sam 12 juil. ». ⚠️ Découpage manuel de la chaîne, PAS `new Date(iso)` :
 * ce dernier parse en UTC et rendrait la veille dans tout fuseau négatif.
 */
export function formatDayLabel(dateISO: string, lang: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  if (!y || !m || !d) return dateISO
  const date = new Date(y, m - 1, d)
  const wd = (WEEKDAY_LABELS[lang] ?? WEEKDAY_LABELS.fr)[date.getDay()]
  const mo = (MONTH_LABELS[lang] ?? MONTH_LABELS.fr)[m - 1]
  return `${wd} ${d} ${mo}`
}
