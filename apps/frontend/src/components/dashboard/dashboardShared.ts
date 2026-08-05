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

/**
 * FRONTIÈRE — `GET /api/dashboard/stats` (#185).
 *
 * ⚠️ OBJET LITTÉRAL construit par le handler (`analytics.ts`), PAS un modèle Prisma : rien ici
 * ne se déduit du schéma. Les quatre blocs détaillés sont scopés au MOIS EN COURS côté serveur
 * (`createdAt: { gte: monthStart }`) — sauf `recentActivity`, qui n'a AUCUNE borne de date.
 * C'est précisément cette asymétrie qui justifie les messages d'état vide de ce module.
 */
export interface ApiDashboardStats {
  salesToday: number
  transactionsToday: number
  salesMonth: number
  transactionsMonth: number
  totalProducts: number
  lowStockProducts: number
  activeEmployees: number
  pendingOrders: number
  /** `null` = pas d'historique comparable → aucun badge de tendance affiché. */
  salesTodayTrend: number | null
  salesMonthTrend: number | null
  /** Top 5 du MOIS ; `name` retombe sur « Produit supprimé » si le produit n'existe plus. */
  topProducts: { name: string; ca: number }[]
  stockAlerts: { name: string; stockQty: number; stockMin: number }[]
  /** ⚠️ AUCUN filtre de date côté serveur : 5 dernières ventes, tous temps confondus. */
  recentActivity: { id: string; total: number; paymentMode: string; createdAt: string }[]
  /** Mois en cours, 6 catégories max, triées par CA décroissant. */
  categoryBreakdown: { name: string; value: number }[]
}

/* ────────────────────────── Série du graphe de ventes ────────────────────────── */

export type SaleForChart = { createdAt: string | Date; total?: number | null }
/** `ts` = minuit LOCAL du jour, en ms — l'axe X est temporel, pas catégoriel. */
export type SalesPoint = { ts: number; name: string; ventes: number; transactions: number }

const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT' }

/**
 * MIROIR de `apps/backend/src/utils/salesWindow.ts` — cas partagés
 * `docs/shared-fixtures/sales-window-cases.json`, rejoués par les deux côtés.
 *
 * ⚠️ Le front en a besoin pour REMPLIR À 0 les jours sans vente : sans la fenêtre exacte du
 * serveur, il inventerait des zéros avant le début réel ou amputerait la période annoncée.
 * Modifier la règle d'un seul côté fait rougir le jumeau d'en face.
 */
export function salesWindowStart(period: string, now: Date): Date {
  const from = new Date(now)
  if (period === 'today') from.setHours(0, 0, 0, 0)
  else if (period === '7days') from.setDate(now.getDate() - 7)
  else if (period === '30days') from.setDate(now.getDate() - 30)
  else if (period === '3months') from.setMonth(now.getMonth() - 3)
  else from.setFullYear(now.getFullYear(), 0, 1)
  return from
}

/** Minuit LOCAL — jamais `toISOString`, qui bascule en UTC et décale d'un jour. */
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/**
 * Jours AFFICHÉS : les N derniers jours pleins, terminant aujourd'hui.
 *
 * ⚠️ La fenêtre serveur est GLISSANTE (elle conserve l'heure : « 7 jours » démarre à
 * J-7 14 h 30), donc son premier jour calendaire n'est couvert qu'en PARTIE. L'afficher
 * comme un jour plein le sous-estimerait, et il ferait basculer « 7 jours » à HUIT points —
 * dont le premier et le dernier tombent le même jour de semaine, ce qui remettrait
 * exactement les libellés dupliqués qu'on vient de fermer. On démarre donc au premier jour
 * PLEIN : « 7 derniers jours » rend 7 points, comme son titre le promet.
 *
 * Conséquence assumée : les ventes de ce premier jour partiel ne sont pas tracées. Elles
 * sont hors de la fenêtre que le titre annonce.
 */
function displayedDays(period: string, now: Date): Date[] {
  const winStart = salesWindowStart(period, now)
  const first = period === 'today' ? startOfDay(winStart) : addDays(winStart, 1)
  const last = startOfDay(now)
  const days: Date[] = []
  for (let d = first; d.getTime() <= last.getTime(); d = addDays(d, 1)) days.push(d)
  return days
}

/** Clé de groupement : jour LOCAL. `toISOString().slice(0,10)` rendrait le jour UTC. */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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
 * ⚠️ La clé de groupement est le jour **LOCAL**, pas `toISOString()` : ce dernier rend le jour
 * UTC, si bien qu'en UTC+1 une vente de 00 h 30 tombait dans le seau de la veille — décalage
 * invisible mais réel, et incohérent avec un axe dont les jours sont ceux du commerçant.
 */
export function buildSalesSeries(
  sales: SaleForChart[],
  period: ChartPeriod,
  lang: Lang,
  now: Date = new Date(),
): SalesPoint[] {
  const byDay = new Map<string, { ventes: number; transactions: number }>()
  for (const sale of sales) {
    const key = dayKey(new Date(sale.createdAt))
    const cur = byDay.get(key) ?? { ventes: 0, transactions: 0 }
    cur.ventes += sale.total ?? 0
    cur.transactions += 1
    byDay.set(key, cur)
  }
  // ⚠️ On itère la FENÊTRE, pas les ventes : un jour sans vente vaut 0, il n'est pas absent.
  // Une série qui saute les jours creux fait mentir la PENTE — sur l'ancien graphe, onze
  // jours sans vente occupaient la même largeur qu'un seul, et la courbe reliait directement
  // deux dates éloignées comme s'il s'agissait de deux jours consécutifs.
  return displayedDays(period, now).map(d => ({
    ts: d.getTime(),
    name: salesPointLabel(d, period, lang),
    ...(byDay.get(dayKey(d)) ?? { ventes: 0, transactions: 0 }),
  }))
}

/**
 * Graduations de l'axe X — au plus `max`, réparties régulièrement, bornes TOUJOURS incluses.
 * À 3 mois la série porte ~90 points : tous les étiqueter rend l'axe illisible.
 */
export function pickAxisTicks(points: SalesPoint[], max = 7): number[] {
  if (points.length <= max) return points.map(p => p.ts)
  const step = (points.length - 1) / (max - 1)
  const idx = new Set<number>()
  for (let i = 0; i < max; i++) idx.add(Math.round(i * step))
  return [...idx].sort((a, b) => a - b).map(i => points[i].ts)
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
export function salesPointLabel(day: Date, period: ChartPeriod, lang: Lang): string {
  const d = day
  return period === '7days'
    ? d.toLocaleDateString(LOCALES[lang], { weekday: 'short' })
    : d.toLocaleDateString(LOCALES[lang], { day: '2-digit', month: '2-digit' })
}
