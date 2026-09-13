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
