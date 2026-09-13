import { describe, it, expect, vi } from 'vitest'
import {
  photonLang, lirePhoton, libellePhoton, rechercherAdresses, geocoderAdresses, cleAdresse,
  lienCarte, INTERVALLE_MS, TILE_ATTRIBUTION, type Stockage,
} from '@/lib/geo'

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
