/**
 * CARTOGRAPHIE ET GÉOCODAGE — OpenStreetMap. SOURCE UNIQUE.
 *
 * Remplace Google Maps (2026-09-13). Tout ce qui parle à un fournisseur cartographique passe
 * ICI : tuiles, recherche d'adresse au fil de la frappe, géocodage des fiches clients. Deux
 * écrans qui choisiraient chacun leur fournisseur, leur cache et leur cadence divergeraient au
 * premier blocage — et un blocage, ici, n'est pas une hypothèse.
 *
 * ── LES RÈGLES D'USAGE SONT DES CONTRAINTES D'ARCHITECTURE, pas des recommandations ──────
 * Lues sur les pages officielles le 2026-09-13, citées mot pour mot :
 *
 *   Nominatim — « Auto-complete search: […] you must not implement such a service on the
 *   client side using the API. » → la saisie au fil de la frappe NE PEUT PAS utiliser
 *   Nominatim. D'où **Photon** (komoot), construit pour cet usage, en « fair use » :
 *   « extensive usage will be throttled. We do not guarantee for the availability ».
 *
 *   Nominatim — « Results must be cached on your side. Clients sending repeatedly the same
 *   query may be classified as faulty and blocked. » L'ancien code Google géocodait TOUS les
 *   clients à CHAQUE ouverture de l'onglet carte, par rafales de cinq, sans aucun cache. Chez
 *   un fournisseur communautaire, c'est la recette d'un blocage d'adresse IP. D'où le cache
 *   persistant ET le cadencement ci-dessous — les deux, pas l'un ou l'autre.
 *
 *   Tuiles OSM — « Commercial services […] should be especially aware that access may be
 *   withdrawn at any point » et « Offline use is not permitted on tile.openstreetmap.org ».
 *   → l'URL des tuiles est CONFIGURABLE (`VITE_MAP_TILE_URL`) pour basculer vers un
 *   fournisseur payant sans toucher au code, et le service worker ne doit JAMAIS mettre de
 *   tuile en cache pour un usage hors-ligne (aucune règle runtime ne les attrape : vérifié).
 *
 *   Attribution — « Show OpenStreetMap licence attribution clearly on the map […]. Do not
 *   hide attribution beneath UI, behind toggles, or off-screen. » → `TILE_ATTRIBUTION`.
 *
 * ── DEUX PIÈGES MESURÉS sur l'API réelle, pas supposés ──────────────────────────────────
 *   1. Photon rend du GeoJSON : `coordinates` vaut **[longitude, latitude]**. Inverser les
 *      deux pose un client de Douala (4,05 N · 9,70 E) au large du Gabon, sans erreur.
 *   2. `lang=es` et `lang=it` rendent **HTTP 400** ; seuls `default`, `en`, `de`, `fr` sont
 *      acceptés. Transmettre la langue de l'application telle quelle cassait l'autocomplétion
 *      pour les utilisateurs espagnols et italiens — en silence, puisqu'une erreur réseau
 *      d'autocomplétion ne s'affiche pas.
 */

import { DEFAULT_MARKET } from '@/lib/defaultMarket'

export type Coordonnees = { lat: number; lng: number }
export type Suggestion = { label: string; lat: number; lng: number }

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}

/** URL des tuiles. OSM par défaut ; à remplacer par un fournisseur à clé au premier refus. */
export const TILE_URL = env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
/** Attribution OBLIGATOIRE (licence ODbL). Ne jamais la masquer ni la retirer. */
export const TILE_ATTRIBUTION = env.VITE_MAP_TILE_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
/** Géocodeur compatible Photon. Instance publique komoot par défaut. */
export const GEOCODER_URL = (env.VITE_GEOCODER_URL || 'https://photon.komoot.io').replace(/\/+$/, '')

/** Lien « ouvrir la carte » vers une adresse — OpenStreetMap, jamais un fournisseur tiers. */
export const lienCarte = (adresse: string) =>
  `https://www.openstreetmap.org/search?query=${encodeURIComponent(adresse)}`

/**
 * Langue transmise à Photon. ⚠️ `es` et `it` rendent HTTP 400 (mesuré) : on les OMET, et
 * Photon répond alors avec les noms locaux. `null` = ne pas envoyer le paramètre.
 */
export function photonLang(lang: unknown): 'fr' | 'en' | 'de' | null {
  return lang === 'fr' || lang === 'en' || lang === 'de' ? lang : null
}

type ProprietesPhoton = Partial<Record<
  'name' | 'housenumber' | 'street' | 'postcode' | 'city' | 'district' | 'county' | 'state' | 'country',
  string
>>

/** Libellé lisible d'un résultat Photon, sans doublon (le `name` vaut souvent la ville). */
export function libellePhoton(p: ProprietesPhoton): string {
  const rue = [p.housenumber, p.street].filter(Boolean).join(' ')
  const parts = [p.name, rue, p.district, [p.postcode, p.city].filter(Boolean).join(' '), p.country]
    .map(s => (s ?? '').trim())
    .filter(Boolean)
  return parts.filter((s, i) => parts.indexOf(s) === i).join(', ')
}

/**
 * Lit une réponse Photon. ⚠️ `coordinates` = **[lon, lat]** (GeoJSON). Défensif : une forme
 * inattendue rend une liste VIDE plutôt qu'une exception qui casserait la saisie.
 */
export function lirePhoton(reponse: unknown): Suggestion[] {
  const features = (reponse as { features?: unknown } | null)?.features
  if (!Array.isArray(features)) return []
  const out: Suggestion[] = []
  for (const f of features) {
    const c = (f as { geometry?: { coordinates?: unknown } })?.geometry?.coordinates
    if (!Array.isArray(c) || c.length < 2) continue
    const [lng, lat] = c.map(Number)
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue
    const label = libellePhoton(((f as { properties?: ProprietesPhoton }).properties) ?? {})
    if (label) out.push({ label, lat, lng })
  }
  return out
}

function urlRecherche(q: string, lang: unknown, limite: number): string {
  const u = new URLSearchParams({ q, limit: String(limite) })
  const l = photonLang(lang)
  if (l) u.set('lang', l)
  return `${GEOCODER_URL}/api/?${u.toString()}`
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOCOMPLÉTION — déclenchée par l'utilisateur, jamais en tâche de fond
// ─────────────────────────────────────────────────────────────────────────────
/** Nombre minimal de caractères avant d'interroger le géocodeur. */
export const MIN_CARACTERES = 3
const memoRecherche = new Map<string, Suggestion[]>()

export async function rechercherAdresses(
  q: string, lang: unknown, signal?: AbortSignal, fetcher: typeof fetch = fetch,
): Promise<Suggestion[]> {
  const requete = q.trim()
  if (requete.length < MIN_CARACTERES) return []
  const cle = `${photonLang(lang) ?? '-'}|${requete.toLowerCase()}`
  const deja = memoRecherche.get(cle)
  if (deja) return deja
  const r = await fetcher(urlRecherche(requete, lang, 5), { signal })
  if (!r.ok) return []
  const liste = lirePhoton(await r.json())
  memoRecherche.set(cle, liste)
  return liste
}

// ─────────────────────────────────────────────────────────────────────────────
// GÉOCODAGE DES FICHES — cache PERSISTANT + cadence ≤ 1 requête/seconde
// ─────────────────────────────────────────────────────────────────────────────
const CLE_CACHE = 'habashop-geocache-v1'
/** Un échec est mémorisé aussi : rejouer la même adresse introuvable, c'est se faire bloquer. */
const TTL_ECHEC_MS = 7 * 24 * 3600 * 1000
/** Écart minimal entre deux requêtes RÉSEAU (la politique Nominatim dit 1/s ; marge incluse). */
export const INTERVALLE_MS = 1100

type Entree = { lat: number; lng: number; a: number } | { echec: true; a: number }
export type Stockage = Pick<Storage, 'getItem' | 'setItem'>

/** Clé d'adresse normalisée : casse, espaces et ponctuation de bord n'en font pas une autre. */
export const cleAdresse = (a: string) => a.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').replace(/^[\s,.;]+|[\s,.;]+$/g, '')

function lireCache(s: Stockage | null): Record<string, Entree> {
  if (!s) return {}
  try { return JSON.parse(s.getItem(CLE_CACHE) ?? '{}') ?? {} } catch { return {} }
}
function ecrireCache(s: Stockage | null, c: Record<string, Entree>) {
  if (!s) return
  // ⚠️ `localStorage` peut refuser (quota, navigation privée) : le cache est une politesse
  // envers le fournisseur, pas une condition de fonctionnement.
  try { s.setItem(CLE_CACHE, JSON.stringify(c)) } catch { /* cache indisponible : on continue sans */ }
}
const stockageParDefaut = (): Stockage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export type ResultatGeocodage =
  | { etat: 'trouve'; pos: Coordonnees }
  | { etat: 'introuvable' }
  | { etat: 'erreur' }

/**
 * Géocode une liste d'adresses. Les adresses en cache ne coûtent AUCUNE requête ; les autres
 * partent UNE À UNE, espacées de `INTERVALLE_MS`. Trois états, jamais deux : « introuvable »
 * (le géocodeur a répondu, sans résultat) n'est pas « erreur » (réseau, refus) — la première
 * se mémorise, la seconde se retentera.
 */
export async function geocoderAdresses(
  adresses: { id: string; adresse: string }[],
  opts: {
    lang?: unknown
    signal?: AbortSignal
    onProgres?: (id: string, r: ResultatGeocodage) => void
    fetcher?: typeof fetch
    stockage?: Stockage | null
    maintenant?: () => number
    attendre?: (ms: number) => Promise<void>
  } = {},
): Promise<Record<string, ResultatGeocodage>> {
  const fetcher = opts.fetcher ?? fetch
  const stockage = opts.stockage === undefined ? stockageParDefaut() : opts.stockage
  const maintenant = opts.maintenant ?? Date.now
  const attendre = opts.attendre ?? (ms => new Promise<void>(r => setTimeout(r, ms)))
  const cache = lireCache(stockage)
  const sortie: Record<string, ResultatGeocodage> = {}
  let derniereRequete = -Infinity

  for (const { id, adresse } of adresses) {
    if (opts.signal?.aborted) break
    const cle = cleAdresse(adresse)
    if (cle.length < MIN_CARACTERES) continue
    const connu = cache[cle]
    if (connu && 'lat' in connu) {
      sortie[id] = { etat: 'trouve', pos: { lat: connu.lat, lng: connu.lng } }
      opts.onProgres?.(id, sortie[id]); continue
    }
    if (connu && 'echec' in connu && maintenant() - connu.a < TTL_ECHEC_MS) {
      sortie[id] = { etat: 'introuvable' }
      opts.onProgres?.(id, sortie[id]); continue
    }

    // ⚠️ La cadence porte sur les requêtes RÉSEAU seulement : cent adresses en cache ne
    // doivent pas coûter cent secondes d'attente.
    const ecart = maintenant() - derniereRequete
    if (ecart < INTERVALLE_MS) await attendre(INTERVALLE_MS - ecart)
    if (opts.signal?.aborted) break
    derniereRequete = maintenant()

    try {
      const r = await fetcher(urlRecherche(adresse.trim(), opts.lang, 1), { signal: opts.signal })
      if (!r.ok) { sortie[id] = { etat: 'erreur' } }
      else {
        const [premier] = lirePhoton(await r.json())
        if (premier) {
          cache[cle] = { lat: premier.lat, lng: premier.lng, a: maintenant() }
          sortie[id] = { etat: 'trouve', pos: { lat: premier.lat, lng: premier.lng } }
        } else {
          cache[cle] = { echec: true, a: maintenant() }
          sortie[id] = { etat: 'introuvable' }
        }
        ecrireCache(stockage, cache)
      }
    } catch {
      if (opts.signal?.aborted) break
      sortie[id] = { etat: 'erreur' }
    }
    opts.onProgres?.(id, sortie[id])
  }
  return sortie
}

/* ════════════════════════════════════════════════════════════════════════════════════════
   VUE DE REPLI — le pays de la BOUTIQUE, jamais une ville en dur
   ════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * Cadrage quand aucun client n'est placé : `bornes` = [[sud, ouest], [nord, est]] (ordre
 * Leaflet, LATITUDE d'abord — l'inverse de Photon), ou `centre` + `zoom`.
 */
export type VueCarte =
  | { pays: string; bornes: [[number, number], [number, number]] }
  | { pays: string; centre: [number, number]; zoom: number }

/**
 * ⚠️ La carte s'ouvrait sur DAKAR pour toute boutique, repli repris de l'implémentation
 * Google — alors que le marché par défaut est le Cameroun et que le pays de la boutique est
 * CONNU. Même famille que le `geoMidpoint` sénégalais du JSON-LD : un fait géographique
 * encodé en coordonnées, qu'aucune recherche de texte ne trouve.
 *
 * ⚠️ MESURÉ, PAS RECOPIÉ DE MÉMOIRE : emprise (`extent`) de chaque pays de
 * `SUPPORTED_COUNTRIES` relevée sur Photon le 2026-09-13 (`osm_tag=place:country`, code
 * pays vérifié), arrondie au centième (~1 km). `geo.test.ts` exige une entrée par pays
 * supporté, périmètre LU dans `apps/backend/src/lib/country.ts`.
 *
 * ⚠️ TROIS EXCEPTIONS NOMMÉES — l'emprise OSM inclut l'outre-mer et ne cadre plus rien :
 * FR (−178° → 172°, le globe entier), US (−180° → 180°), NL (jusqu'aux Caraïbes, −70°).
 * On y prend le point du pays rendu par Photon, avec un zoom CHOISI (non mesuré). ES et PT
 * gardent leur emprise : Canaries, Açores et Madère restent à l'écran, c'est leur marché.
 */
const VUES_PAYS: Record<string, { bornes: [[number, number], [number, number]] } | { centre: [number, number]; zoom: number }> = {
  SN: { bornes: [[12.24, -17.75], [16.69, -11.35]] },
  CI: { bornes: [[4.16, -8.6], [10.74, -2.49]] },
  ML: { bornes: [[10.15, -12.24], [25, 4.27]] },
  BF: { bornes: [[9.41, -5.51], [15.08, 2.41]] },
  NE: { bornes: [[11.69, 0.17], [23.52, 16]] },
  TG: { bornes: [[5.93, -0.14], [11.14, 1.81]] },
  BJ: { bornes: [[6.04, 0.78], [12.41, 3.85]] },
  GW: { bornes: [[10.65, -16.9], [12.69, -13.63]] },
  CM: { bornes: [[1.65, 8.38], [13.08, 16.19]] },
  CG: { bornes: [[-5.15, 11.02], [3.71, 18.64]] },
  CD: { bornes: [[-13.46, 12.04], [5.39, 31.31]] },
  CF: { bornes: [[2.22, 14.41], [11, 27.47]] },
  GA: { bornes: [[-4.11, 8.5], [2.32, 14.53]] },
  TD: { bornes: [[7.44, 13.47], [23.45, 24]] },
  GQ: { bornes: [[-1.67, 5.42], [3.99, 11.41]] },
  GN: { bornes: [[7.19, -15.57], [12.68, -7.64]] },
  GH: { bornes: [[4.54, -3.26], [11.17, 1.27]] },
  NG: { bornes: [[4.07, 2.68], [13.89, 14.68]] },
  FR: { centre: [46.6, 1.89], zoom: 5 },
  BE: { bornes: [[49.5, 2.39], [51.55, 6.41]] },
  DE: { bornes: [[47.27, 5.87], [55.1, 15.04]] },
  IT: { bornes: [[35.29, 6.63], [47.09, 18.78]] },
  ES: { bornes: [[27.43, -18.39], [43.99, 4.59]] },
  NL: { centre: [52.24, 5.63], zoom: 7 },
  PT: { bornes: [[29.83, -31.56], [42.15, -6.19]] },
  CH: { bornes: [[45.82, 5.96], [47.81, 10.49]] },
  MA: { bornes: [[21.33, -17.24], [36, -1]] },
  DZ: { bornes: [[18.97, -8.67], [37.3, 12]] },
  TN: { bornes: [[30.23, 7.52], [37.76, 11.88]] },
  US: { centre: [39.78, -100.45], zoom: 4 },
  CA: { bornes: [[41.68, -141], [83.34, -52.32]] },
  GB: { bornes: [[49.67, -14.02], [61.06, 2.09]] },
}

/** Vue de repli pour un pays. Absent, inconnu ou non chaîne → marché par défaut. */
export function vueDuPays(country: unknown): VueCarte {
  // ⚠️ `unknown` : le pays vient d'un store persisté et d'un JSON d'API (cf. `dialCodeFor`).
  const iso = typeof country === 'string' ? country.toUpperCase() : ''
  const pays = iso in VUES_PAYS ? iso : DEFAULT_MARKET.country
  return { pays, ...VUES_PAYS[pays] }
}
