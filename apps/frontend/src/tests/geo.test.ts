import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  photonLang, lirePhoton, libellePhoton, rechercherAdresses, geocoderAdresses, cleAdresse,
  lienCarte, INTERVALLE_MS, TILE_ATTRIBUTION, vueDuPays, type Stockage, type VueCarte,
} from '@/lib/geo'
import { DEFAULT_MARKET } from '@/lib/defaultMarket'

/**
 * OPENSTREETMAP — les pièges MESURÉS sur l'API réelle le 2026-09-13, et la politesse que les
 * règles d'usage exigent. Aucun appel réseau : le `fetch` est injecté.
 */

/** Réponse Photon RÉELLE, relevée le 2026-09-13 (q=Akwa Douala), réduite au nécessaire. */
const DOUALA = {
  type: 'FeatureCollection',
  features: [{
    geometry: { type: 'Point', coordinates: [9.7042972, 4.0506315] },
    properties: { name: 'Akwa', city: 'Douala', country: 'Cameroun', countrycode: 'CM' },
  }],
}

const reponse = (corps: unknown, ok = true) => ({ ok, json: async () => corps }) as Response
const memoire = (): Stockage & { d: Record<string, string> } => {
  const d: Record<string, string> = {}
  return { d, getItem: k => d[k] ?? null, setItem: (k, v) => { d[k] = v } }
}

describe('Photon — les deux pièges mesurés', () => {
  it('⚠️ coordonnées GeoJSON = [LONGITUDE, LATITUDE], jamais l’inverse', () => {
    // Inverser pose Douala (4,05 N · 9,70 E) au large du Gabon (9,70 N · 4,05 E), sans erreur.
    const [s] = lirePhoton(DOUALA)
    expect(s.lat).toBeCloseTo(4.0506, 3)
    expect(s.lng).toBeCloseTo(9.7043, 3)
  })

  it('⚠️ es et it ne sont PAS transmis — Photon répond HTTP 400 (mesuré)', () => {
    expect(photonLang('fr')).toBe('fr')
    expect(photonLang('en')).toBe('en')
    expect(photonLang('es')).toBeNull()
    expect(photonLang('it')).toBeNull()
    expect(photonLang(undefined)).toBeNull()
  })

  it('l’URL de recherche omet `lang` pour l’espagnol — sans quoi la saisie casse en silence', async () => {
    const f = vi.fn(async () => reponse(DOUALA))
    await rechercherAdresses('Akwa Douala', 'es', undefined, f as unknown as typeof fetch)
    expect(String((f.mock.calls[0] as unknown[])[0])).not.toMatch(/[?&]lang=/)
    await rechercherAdresses('Akwa Douala centre', 'fr', undefined, f as unknown as typeof fetch)
    expect(String((f.mock.calls[1] as unknown[])[0])).toMatch(/[?&]lang=fr/)
  })

  it('une forme inattendue rend une liste VIDE, jamais une exception', () => {
    for (const bizarre of [null, {}, { features: 'x' }, { features: [{ geometry: { coordinates: ['a'] } }] }]) {
      expect(lirePhoton(bizarre)).toEqual([])
    }
    // Hors bornes (lat > 90) : la preuve typique d'un ordre inversé côté source.
    expect(lirePhoton({ features: [{ geometry: { coordinates: [4, 120] }, properties: { name: 'x' } }] })).toEqual([])
  })

  it('libellé sans doublon — le `name` Photon vaut souvent la ville', () => {
    expect(libellePhoton({ name: 'Douala', city: 'Douala', country: 'Cameroun' })).toBe('Douala, Cameroun')
    expect(libellePhoton({ housenumber: '12', street: 'Rue Joss', postcode: '', city: 'Douala' })).toBe('12 Rue Joss, Douala')
  })
})

describe('autocomplétion — aucune requête inutile', () => {
  it('rien sous 3 caractères', async () => {
    const f = vi.fn(async () => reponse(DOUALA))
    expect(await rechercherAdresses('Ak', 'fr', undefined, f as unknown as typeof fetch)).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })

  it('la même requête n’est émise qu’UNE fois (mémo)', async () => {
    const f = vi.fn(async () => reponse(DOUALA))
    await rechercherAdresses('Bonapriso Douala', 'fr', undefined, f as unknown as typeof fetch)
    await rechercherAdresses('  bonapriso douala ', 'fr', undefined, f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('géocodage des fiches — cache PERSISTANT et cadence (règles d’usage)', () => {
  const horloge = () => {
    let t = 1_000_000
    return { maintenant: () => t, attendre: vi.fn(async (ms: number) => { t += ms }) }
  }

  it('⚠️ une adresse en cache ne coûte AUCUNE requête — la seconde ouverture est gratuite', async () => {
    const s = memoire(); const h = horloge()
    const f = vi.fn(async () => reponse(DOUALA))
    const opts = { fetcher: f as unknown as typeof fetch, stockage: s, ...h }
    await geocoderAdresses([{ id: 'c1', adresse: 'Akwa, Douala' }], opts)
    await geocoderAdresses([{ id: 'c1', adresse: '  akwa,   douala ' }], opts)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('⚠️ les requêtes RÉSEAU sont espacées d’au moins INTERVALLE_MS — jamais en rafale', async () => {
    const h = horloge(); const instants: number[] = []
    const f = vi.fn(async () => { instants.push(h.maintenant()); return reponse(DOUALA) })
    await geocoderAdresses(
      ['a1 rue x', 'b2 rue y', 'c3 rue z'].map((adresse, i) => ({ id: `c${i}`, adresse })),
      { fetcher: f as unknown as typeof fetch, stockage: memoire(), ...h },
    )
    expect(f).toHaveBeenCalledTimes(3)
    for (let i = 1; i < instants.length; i++) {
      expect(instants[i] - instants[i - 1]).toBeGreaterThanOrEqual(INTERVALLE_MS)
    }
  })

  it('DISCRIMINANT — cent adresses en cache ne coûtent AUCUNE attente', async () => {
    // Sans ce cas, une cadence appliquée à TOUT (cache compris) passerait le test précédent
    // et ferait attendre cent secondes à un écran qui n'a rien demandé au réseau.
    const s = memoire(); const h = horloge()
    const f = vi.fn(async () => reponse(DOUALA))
    const liste = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, adresse: 'Akwa, Douala' }))
    await geocoderAdresses(liste, { fetcher: f as unknown as typeof fetch, stockage: s, ...h })
    expect(f).toHaveBeenCalledTimes(1)
    expect(h.attendre).not.toHaveBeenCalled()
  })

  it('⚠️ TROIS états : introuvable (mémorisé) ≠ erreur (retentée)', async () => {
    const s = memoire(); const h = horloge()
    const vide = vi.fn(async () => reponse({ type: 'FeatureCollection', features: [] }))
    const r1 = await geocoderAdresses([{ id: 'x', adresse: 'adresse inexistante' }], { fetcher: vide as unknown as typeof fetch, stockage: s, ...h })
    expect(r1.x).toEqual({ etat: 'introuvable' })
    // Rejouer une adresse introuvable, c'est être « classé défectueux et bloqué » : mémorisée.
    await geocoderAdresses([{ id: 'x', adresse: 'adresse inexistante' }], { fetcher: vide as unknown as typeof fetch, stockage: s, ...h })
    expect(vide).toHaveBeenCalledTimes(1)

    const panne = vi.fn(async () => reponse({}, false))
    const r2 = await geocoderAdresses([{ id: 'y', adresse: 'autre adresse' }], { fetcher: panne as unknown as typeof fetch, stockage: s, ...h })
    expect(r2.y).toEqual({ etat: 'erreur' })
    // Une erreur n'est PAS mémorisée : elle se retente.
    await geocoderAdresses([{ id: 'y', adresse: 'autre adresse' }], { fetcher: panne as unknown as typeof fetch, stockage: s, ...h })
    expect(panne).toHaveBeenCalledTimes(2)
  })

  it('un stockage qui refuse d’écrire ne casse pas le géocodage', async () => {
    const h = horloge()
    const hostile: Stockage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded') } }
    const f = vi.fn(async () => reponse(DOUALA))
    const r = await geocoderAdresses([{ id: 'c', adresse: 'Akwa, Douala' }], { fetcher: f as unknown as typeof fetch, stockage: hostile, ...h })
    expect(r.c.etat).toBe('trouve')
  })

  it('normalisation de clé : casse et espaces ne font pas une autre adresse', () => {
    expect(cleAdresse('  Akwa,   DOUALA. ')).toBe(cleAdresse('akwa, douala'))
  })
})

describe('obligations de licence et liens sortants', () => {
  it('l’attribution OSM est présente et nomme la licence', () => {
    expect(TILE_ATTRIBUTION).toMatch(/OpenStreetMap/)
    expect(TILE_ATTRIBUTION).toMatch(/openstreetmap\.org\/copyright/)
  })

  it('le lien « ouvrir la carte » pointe vers OpenStreetMap et échappe l’adresse', () => {
    const u = lienCarte('12 rue & fils, Douala')
    expect(u.startsWith('https://www.openstreetmap.org/search?query=')).toBe(true)
    expect(u).not.toMatch(/google/i)
    expect(u).toContain(encodeURIComponent('&'))
  })
})

describe('vue de repli — le pays de la boutique, plus Dakar en dur', () => {
  /** Périmètre DÉRIVÉ : les pays que le serveur accepte, lus dans sa source — pas une liste recopiée. */
  const supportes = (() => {
    const src = readFileSync(join(__dirname, '../../../backend/src/lib/country.ts'), 'utf8')
    const bloc = src.slice(src.indexOf('export const SUPPORTED_COUNTRIES'), src.indexOf('] as const'))
    return [...bloc.matchAll(/'([A-Z]{2})'/g)].map(m => m[1])
  })()
  const contient = (v: VueCarte, lat: number, lng: number) => 'bornes' in v
    && lat >= v.bornes[0][0] && lat <= v.bornes[1][0] && lng >= v.bornes[0][1] && lng <= v.bornes[1][1]

  it('couverture : le périmètre lu n’est pas vide', () => {
    expect(supportes.length).toBeGreaterThanOrEqual(30)
    expect(supportes).toContain('CM')
  })

  it('chaque pays supporté a SA vue — aucun ne retombe en silence sur le marché par défaut', () => {
    const sansVue = supportes.filter(iso => iso !== DEFAULT_MARKET.country && vueDuPays(iso).pays !== iso)
    expect(sansVue).toEqual([])
  })

  it('⚠️ DISCRIMINANT — une boutique camerounaise ne s’ouvre plus sur Dakar', () => {
    const cm = vueDuPays('CM')
    expect(contient(cm, 4.05, 9.70), 'Douala dans la vue').toBe(true)
    expect(contient(cm, 3.87, 11.52), 'Yaoundé dans la vue').toBe(true)
    expect(contient(cm, 14.69, -17.45), 'Dakar HORS de la vue').toBe(false)
    expect(contient(vueDuPays('sn'), 14.69, -17.45), 'Dakar dans la vue du Sénégal').toBe(true)
  })

  it('pays absent, inconnu ou non chaîne → marché par défaut', () => {
    for (const x of [undefined, null, '', 'XX', 42, { iso: 'SN' }]) expect(vueDuPays(x).pays).toBe(DEFAULT_MARKET.country)
  })

  it('⚠️ chaque vue est la MESURE Photon, retranscrite dans l’ordre Leaflet — confrontée à la réponse brute', () => {
    // La réponse brute est versionnée TELLE QUE RELEVÉE : `extent` = [ouest, nord, est, sud] et
    // `point` = [lon, lat], l'ordre GeoJSON. Un contrôle « sud < nord » seul ne voit pas une
    // inversion lat/lng sur un pays dont les deux restent plausibles (sabotage sur TD : vert).
    const brut = JSON.parse(readFileSync(join(__dirname, 'fixtures/emprises-photon-2026-09-13.json'), 'utf8')) as
      Record<string, { extent: [number, number, number, number]; point: [number, number] }>
    const r2 = (x: number) => Math.round(x * 100) / 100
    expect(Object.keys(brut).sort()).toEqual([...supportes].sort())
    for (const iso of supportes) {
      const v = vueDuPays(iso), { extent: [o, n, e, s], point: [lon, lat] } = brut[iso]
      if ('bornes' in v) expect(v.bornes, iso).toEqual([[r2(s), r2(o)], [r2(n), r2(e)]])
      else expect(v.centre, iso).toEqual([r2(lat), r2(lon)])
    }
  })

  it('⚠️ bornes en ordre LEAFLET [lat, lng], sud < nord, ouest < est — jamais l’ordre Photon', () => {
    for (const iso of supportes) {
      const v = vueDuPays(iso)
      if (!('bornes' in v)) continue
      const [[s, o], [n, e]] = v.bornes
      expect(s < n && o < e, `${iso} : bornes inversées`).toBe(true)
      expect(Math.abs(s) <= 90 && Math.abs(n) <= 90, `${iso} : latitude hors bornes (ordre lon/lat ?)`).toBe(true)
    }
  })

  it('⚠️ aucune emprise d’outre-mer qui cadrerait le globe (FR, US, NL mesurés ainsi sur Photon)', () => {
    // Seuil 60° : l'emprise brute des Pays-Bas en fait 77,5 (Caraïbes). EXCEPTION NOMMÉE : le
    // Canada fait RÉELLEMENT 88,7° de large (mesuré), sans outre-mer.
    for (const iso of supportes.filter(i => i !== 'CA')) {
      const v = vueDuPays(iso)
      if ('bornes' in v) expect(v.bornes[1][1] - v.bornes[0][1], `${iso} : ${v.bornes[1][1] - v.bornes[0][1]}° de large`).toBeLessThan(60)
    }
    const fr = vueDuPays('FR')
    expect('centre' in fr && fr.centre[0] > 41 && fr.centre[0] < 51 && fr.centre[1] > -5 && fr.centre[1] < 9, 'FR centrée sur la métropole').toBe(true)
  })
})
