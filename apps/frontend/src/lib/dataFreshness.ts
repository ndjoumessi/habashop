/**
 * Fraîcheur des données à CONSÉQUENCE (Chantier B — classe « affichage »).
 *
 * ⚠️ Un horodatage global unique MENTIRAIT : il passerait au vert parce que les images
 * ou les libellés viennent de resynchroniser, alors que les PRIX ont trois heures. On
 * garde donc un horodatage PAR CLASSE, et l'indicateur montre le PLUS ANCIEN — la
 * donnée la moins fraîche est celle qui décide de ce qu'on peut affirmer.
 *
 * Rien ici ne bloque quoi que ce soit : c'est de l'information, jamais une garde.
 */

/** Classes de données dont la péremption a une conséquence visible en caisse. */
export const FRESHNESS_KINDS = ['catalog'] as const
export type FreshnessKind = (typeof FRESHNESS_KINDS)[number]

/** Horodatages (ms epoch) par classe. Classe absente = JAMAIS synchronisée. */
export type FreshnessMap = Partial<Record<FreshnessKind, number>>

export type OldestFreshness =
  | { kind: FreshnessKind; at: number; neverSynced: false }
  | { kind: FreshnessKind; at: null; neverSynced: true }

/**
 * La classe la moins fraîche. Une classe jamais synchronisée l'emporte sur toute
 * date : « jamais » est plus vieux que n'importe quel « il y a X ».
 */
export function oldestFreshness(
  map: FreshnessMap,
  kinds: readonly FreshnessKind[] = FRESHNESS_KINDS,
): OldestFreshness | null {
  if (kinds.length === 0) return null
  const never = kinds.find(k => map[k] == null)
  if (never) return { kind: never, at: null, neverSynced: true }
  let worst: { kind: FreshnessKind; at: number } | null = null
  for (const k of kinds) {
    const at = map[k] as number
    if (!worst || at < worst.at) worst = { kind: k, at }
  }
  return worst ? { ...worst, neverSynced: false } : null
}

/** Âge en ms, borné à 0 (une horloge qui recule ne doit pas produire un âge négatif). */
export function freshnessAge(at: number, now: number): number {
  return Math.max(0, now - at)
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/**
 * Palier d'ancienneté. Purement INDICATIF : aucun palier ne restreint une action,
 * et surtout aucun n'empêche d'encaisser.
 */
export function freshnessLevel(ageMs: number | null): 'fresh' | 'aging' | 'stale' {
  if (ageMs === null) return 'stale'      // jamais synchronisé
  if (ageMs < 15 * MIN) return 'fresh'
  if (ageMs < 6 * HOUR) return 'aging'
  return 'stale'
}

const T = {
  never:   { fr: 'jamais synchronisé', en: 'never synced', es: 'nunca sincronizado', it: 'mai sincronizzato' },
  now:     { fr: "à l'instant", en: 'just now', es: 'ahora mismo', it: 'proprio ora' },
  ago:     { fr: 'il y a', en: '', es: 'hace', it: '' },
  agoPost: { fr: '', en: 'ago', es: '', it: 'fa' },
  min:     { fr: 'min', en: 'min', es: 'min', it: 'min' },
  hour:    { fr: 'h', en: 'h', es: 'h', it: 'h' },
  day:     { fr: 'j', en: 'd', es: 'd', it: 'g' },
}
const pick = (k: keyof typeof T, lang: string) => T[k][lang as 'fr'] ?? T[k].fr

/**
 * « il y a 3 min » / « 3 min ago » / « hace 3 min » / « 3 min fa ».
 * `null` (jamais synchronisé) est dit tel quel — on n'invente pas une date.
 */
export function freshnessLabel(ageMs: number | null, lang: string): string {
  if (ageMs === null) return pick('never', lang)
  if (ageMs < MIN) return pick('now', lang)
  const n = ageMs < HOUR ? Math.floor(ageMs / MIN)
    : ageMs < DAY ? Math.floor(ageMs / HOUR)
    : Math.floor(ageMs / DAY)
  const unit = ageMs < HOUR ? pick('min', lang) : ageMs < DAY ? pick('hour', lang) : pick('day', lang)
  const pre = pick('ago', lang)
  const post = pick('agoPost', lang)
  return [pre, `${n} ${unit}`, post].filter(Boolean).join(' ')
}

/** Libellé d'une classe, pour le détail au survol/tap. */
export function freshnessKindLabel(kind: FreshnessKind, lang: string): string {
  const L: Record<FreshnessKind, Record<string, string>> = {
    catalog: { fr: 'Catalogue et prix', en: 'Catalogue and prices', es: 'Catálogo y precios', it: 'Catalogo e prezzi' },
  }
  return L[kind][lang] ?? L[kind].fr
}
