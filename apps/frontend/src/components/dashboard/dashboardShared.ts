import type { Lang } from '@/stores/appStore'

/**
 * Tableau de bord — libellés de PÉRIODE et messages d'état VIDE.
 *
 * ⚠️ RÈGLE : un vide doit NOMMER SA FENÊTRE. « Aucune vente pour le moment » s'affichait sur
 * un graphe à 7 jours à un commerçant dont les dernières ventes dataient de 12 jours : il
 * lisait que sa donnée avait disparu. Le vide d'une fenêtre glissante n'est pas le vide de
 * l'historique, et un écran qui confond les deux fait paniquer sur une donnée intacte.
 *
 * ⚠️ « Pour le moment » reste LÉGITIME là où la requête n'a pas de borne temporelle — c'est
 * le cas du fil d'activité (`analytics.ts` : `prisma.sale.findMany({ where: { tenantId } })`,
 * aucun `createdAt`) : vide y veut bien dire « jamais ». D'où un module scopé aux surfaces
 * RÉELLEMENT fenêtrées, et non une police du vocabulaire sur tout le dépôt — laquelle
 * crierait d'ailleurs au loup sur « Max 1 campagna per ora » (`per ora` = « par heure »).
 */

/** Périodes du sélecteur du graphe de ventes. */
export type ChartPeriod = '7days' | '30days' | '3months'

/**
 * ⚠️ Ces trois `Record<ChartPeriod, …>` sont LOAD-BEARING : ajouter une période sans lui
 * écrire ses libellés rend `tsc` ROUGE. Le sélecteur de `Dashboard.tsx` est RENDU à partir
 * de `CHART_PERIODS` — il ne peut donc pas offrir une option que ces tables ignorent, ce
 * qu'un `as ChartPeriod` sur la valeur du `<select>` aurait au contraire laissé passer.
 */

/** Libellé court : les `<option>` du sélecteur. */
const PERIOD_OPTION: Record<ChartPeriod, Record<Lang, string>> = {
  '7days':   { fr: '7 jours',  en: '7 days',   es: '7 días',   it: '7 giorni' },
  '30days':  { fr: '30 jours', en: '30 days',  es: '30 días',  it: '30 giorni' },
  '3months': { fr: '3 mois',   en: '3 months', es: '3 meses',  it: '3 mesi' },
}

/** Titre du panneau — ⚠️ il SUIT la période choisie (il était figé sur « 7 derniers jours »). */
const PERIOD_TITLE: Record<ChartPeriod, Record<Lang, string>> = {
  '7days': {
    fr: 'Ventes — 7 derniers jours',
    en: 'Sales — Last 7 days',
    es: 'Ventas — Últimos 7 días',
    it: 'Vendite — Ultimi 7 giorni',
  },
  '30days': {
    fr: 'Ventes — 30 derniers jours',
    en: 'Sales — Last 30 days',
    es: 'Ventas — Últimos 30 días',
    it: 'Vendite — Ultimi 30 giorni',
  },
  '3months': {
    fr: 'Ventes — 3 derniers mois',
    en: 'Sales — Last 3 months',
    es: 'Ventas — Últimos 3 meses',
    it: 'Vendite — Ultimi 3 mesi',
  },
}

/** État vide du graphe : le vide est celui de la période SÉLECTIONNÉE. */
const NO_SALES_IN_PERIOD: Record<ChartPeriod, Record<Lang, string>> = {
  '7days': {
    fr: 'Aucune vente sur les 7 derniers jours',
    en: 'No sales in the last 7 days',
    es: 'Sin ventas en los últimos 7 días',
    it: 'Nessuna vendita negli ultimi 7 giorni',
  },
  '30days': {
    fr: 'Aucune vente sur les 30 derniers jours',
    en: 'No sales in the last 30 days',
    es: 'Sin ventas en los últimos 30 días',
    it: 'Nessuna vendita negli ultimi 30 giorni',
  },
  '3months': {
    fr: 'Aucune vente sur les 3 derniers mois',
    en: 'No sales in the last 3 months',
    es: 'Sin ventas en los últimos 3 meses',
    it: 'Nessuna vendita negli ultimi 3 mesi',
  },
}

/**
 * Top produits et CA par catégorie : les deux sont scopés au MOIS EN COURS côté serveur
 * (`analytics.ts`, `createdAt: { gte: monthStart }`). Le mois précédent peut être plein.
 */
const NO_SALES_THIS_MONTH: Record<Lang, string> = {
  fr: 'Aucune vente ce mois-ci',
  en: 'No sales this month',
  es: 'Ninguna venta este mes',
  it: 'Nessuna vendita questo mese',
}

/** Source unique de la liste des périodes — le `<select>` en dérive, ainsi que les tests. */
export const CHART_PERIODS = Object.keys(PERIOD_OPTION) as ChartPeriod[]

/** Garde de saisie : évite un `as ChartPeriod` sur la valeur brute du `<select>`. */
export function isChartPeriod(value: string): value is ChartPeriod {
  return Object.prototype.hasOwnProperty.call(PERIOD_OPTION, value)
}

export function periodOptionLabel(period: ChartPeriod, lang: Lang): string {
  return PERIOD_OPTION[period][lang]
}

export function salesChartTitle(period: ChartPeriod, lang: Lang): string {
  return PERIOD_TITLE[period][lang]
}

export function noSalesInPeriodLabel(period: ChartPeriod, lang: Lang): string {
  return NO_SALES_IN_PERIOD[period][lang]
}

export function noSalesThisMonthLabel(lang: Lang): string {
  return NO_SALES_THIS_MONTH[lang]
}

/* ────────────────────────── Série du graphe de ventes ────────────────────────── */

export type SaleForChart = { createdAt: string | Date; total?: number | null }
export type SalesPoint = { name: string; ventes: number; transactions: number }

const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT' }

/**
 * Agrège les ventes en SÉRIE TEMPORELLE — un point par DATE, en ordre chronologique.
 *
 * ⚠️ Groupement par DATE, **jamais** par nom de jour. La version précédente prenait
 * `labels[d.getDay()]` pour clé : sur « 3 mois », les ~13 mercredis s'additionnaient en un
 * seul point « Mer », et `Object.values` rendait l'ordre D'APPARITION — d'où un axe
 * « Sam · Ven · Mer · Mar · Lun · Dim · Jeu ». Ce n'était pas une série temporelle mais un
 * histogramme par jour de semaine, tracé en COURBE CONTINUE comme s'il était chronologique :
 * un pic s'y lisait comme une bonne journée alors qu'il cumulait trois mois de mercredis.
 *
 * ⚠️ La clé de groupement est la date **ISO** (`YYYY-MM-DD`) : elle trie chronologiquement en
 * comparaison de chaînes, contrairement à un libellé affiché qui dépend de la langue.
 */
export function buildSalesSeries(sales: SaleForChart[], period: ChartPeriod, lang: Lang): SalesPoint[] {
  const byDate = new Map<string, { ventes: number; transactions: number }>()
  for (const sale of sales) {
    const key = new Date(sale.createdAt).toISOString().slice(0, 10)
    const cur = byDate.get(key) ?? { ventes: 0, transactions: 0 }
    cur.ventes += sale.total ?? 0
    cur.transactions += 1
    byDate.set(key, cur)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, v]) => ({ name: salesPointLabel(iso, period, lang), ...v }))
}

/**
 * Libellé d'un point — la FORME dépend de la période.
 *
 * ⚠️ Au-delà de 7 jours, le nom de jour ne suffit plus : deux points porteraient le même
 * libellé (« Mer » et « Mer »), ce qui est précisément ce qui rendait l'ancien axe illisible.
 *
 * ⚠️ `T00:00:00` — sans lui, `new Date('2026-08-05')` est lu minuit **UTC** et recule d'un
 * jour en fuseau négatif (même piège que `fmtDate`, cf. § Pièges techniques).
 */
export function salesPointLabel(iso: string, period: ChartPeriod, lang: Lang): string {
  const d = new Date(`${iso}T00:00:00`)
  return period === '7days'
    ? d.toLocaleDateString(LOCALES[lang], { weekday: 'short' })
    : d.toLocaleDateString(LOCALES[lang], { day: '2-digit', month: '2-digit' })
}
