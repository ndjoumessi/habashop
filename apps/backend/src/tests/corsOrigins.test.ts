import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import {
  buildAllowedOrigins, isOriginAllowed, normalizeOrigin, isLocalhostOrigin, LEGACY_APP_ORIGIN,
} from '../lib/corsOrigins'
import { appBaseUrl } from '../lib/appUrl'

// ⚠️ CORS — LE CHEMIN LE PLUS DANGEREUX DU JOUR DE LA MIGRATION DE DOMAINE.
//
// Le défaut d'origine était un JUMEAU NON TRAITÉ : `FRONTEND_URL` avait deux lecteurs qui ne
// normalisaient pas pareil — `lib/appUrl.ts` retire la barre oblique finale, `server.ts`
// poussait la valeur BRUTE dans la liste CORS. `FRONTEND_URL=https://app.exemple.com/` (la
// forme qu'on copie depuis une barre d'adresse) donnait donc des e-mails JUSTES et une
// application MORTE : le navigateur envoie `Origin: https://app.exemple.com`, sans barre.
// Aucune correspondance, toutes les requêtes refusées, écran vide, aucune erreur parlante.
//
// Ce verrou juge la RÉPONSE HTTP, pas la logique : `access-control-allow-origin` sur un vrai
// `@fastify/cors`, via la fonction de décision RÉELLE (`isOriginAllowed`). Un test qui
// rejouerait la comparaison resterait vert pendant que le serveur en applique une autre.

const NEUVE = 'https://app.exemple.com'

/** Monte un serveur avec la MÊME décision que `server.ts`, et rend l'en-tête obtenu. */
async function origineRenvoyee(origin: string, allowed: string[]): Promise<string | undefined> {
  const app = Fastify()
  await app.register(cors, {
    origin: (o, cb) => {
      if (!o) return cb(null, true)
      if (isOriginAllowed(o, allowed)) return cb(null, true)
      cb(new Error('CORS not allowed'), false)
    },
    credentials: true,
  })
  app.get('/ping', async () => ({ ok: true }))
  const res = await app.inject({ method: 'GET', url: '/ping', headers: { origin } })
  await app.close()
  return res.headers['access-control-allow-origin'] as string | undefined
}

describe('CORS — la liste', () => {
  const ORIG_F = process.env.FRONTEND_URL
  const ORIG_X = process.env.CORS_EXTRA_ORIGINS
  beforeEach(() => { delete process.env.FRONTEND_URL; delete process.env.CORS_EXTRA_ORIGINS })
  afterEach(() => {
    if (ORIG_F === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = ORIG_F
    if (ORIG_X === undefined) delete process.env.CORS_EXTRA_ORIGINS; else process.env.CORS_EXTRA_ORIGINS = ORIG_X
  })

  it('sans env → l’hôte historique SEUL (additif : comportement d’aujourd’hui inchangé)', () => {
    expect(buildAllowedOrigins({} as NodeJS.ProcessEnv)).toEqual({ origins: [LEGACY_APP_ORIGIN], rejected: [] })
  })

  it('l’hôte historique reste autorisé quand FRONTEND_URL bascule — la migration est un AJOUT', () => {
    const { origins } = buildAllowedOrigins({ FRONTEND_URL: NEUVE } as NodeJS.ProcessEnv)
    expect(origins).toContain(LEGACY_APP_ORIGIN)
    expect(origins).toContain(NEUVE)
  })

  it('CORS_EXTRA_ORIGINS autorise la nouvelle origine AVANT de basculer FRONTEND_URL', () => {
    // C'est tout l'objet de la variable : dissoudre l'ordre contraint de la migration.
    const { origins } = buildAllowedOrigins({ CORS_EXTRA_ORIGINS: NEUVE } as NodeJS.ProcessEnv)
    expect(origins).toEqual([LEGACY_APP_ORIGIN, NEUVE])
  })

  it('liste multiple — virgule, point-virgule ou espace', () => {
    const { origins } = buildAllowedOrigins({
      CORS_EXTRA_ORIGINS: 'https://a.exemple.com, https://b.exemple.com;https://c.exemple.com',
    } as NodeJS.ProcessEnv)
    expect(origins).toEqual([LEGACY_APP_ORIGIN, 'https://a.exemple.com', 'https://b.exemple.com', 'https://c.exemple.com'])
  })

  it('doublon FRONTEND_URL / CORS_EXTRA_ORIGINS → une seule entrée', () => {
    const { origins } = buildAllowedOrigins({ FRONTEND_URL: NEUVE, CORS_EXTRA_ORIGINS: `${NEUVE}/` } as NodeJS.ProcessEnv)
    expect(origins.filter(o => o === NEUVE)).toHaveLength(1)
  })
})

describe('CORS — LE JUMEAU : les deux lecteurs de FRONTEND_URL normalisent PAREIL', () => {
  const ORIG = process.env.FRONTEND_URL
  afterEach(() => { if (ORIG === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = ORIG })

  it('barre oblique finale : la liste CORS et appBaseUrl rendent la MÊME chaîne', () => {
    // LE défaut d'origine. `appBaseUrl` normalisait, `server.ts` non → e-mails justes,
    // application morte. Les deux lectures sont désormais épinglées l'une à l'autre.
    for (const brut of [`${NEUVE}/`, `${NEUVE}///`, `  ${NEUVE}  `]) {
      process.env.FRONTEND_URL = brut
      const { origins } = buildAllowedOrigins()
      expect(origins).toContain(appBaseUrl())
      expect(appBaseUrl()).toBe(NEUVE)
    }
  })
})

describe('CORS — les entrées qui ne peuvent PAS correspondre sont REJETÉES, et DITES', () => {
  it('rejet nommé : schéma manquant, chemin, joker, espace interne', () => {
    // Une entrée malformée produit le MÊME écran vide qu'un oubli. L'écarter en silence
    // rendrait une garde absente indistinguable d'une garde qui refuse.
    const { origins, rejected } = buildAllowedOrigins({
      CORS_EXTRA_ORIGINS: 'app.exemple.com|*|https://a.exemple.com/chemin|ftp://x.exemple.com',
    } as NodeJS.ProcessEnv)
    expect(origins).toEqual([LEGACY_APP_ORIGIN])
    expect(rejected).toEqual(['app.exemple.com|*|https://a.exemple.com/chemin|ftp://x.exemple.com'])
  })

  it('chaque entrée d’une liste est jugée séparément — une mauvaise n’emporte pas les bonnes', () => {
    const { origins, rejected } = buildAllowedOrigins({
      CORS_EXTRA_ORIGINS: 'app.exemple.com, https://bon.exemple.com, *',
    } as NodeJS.ProcessEnv)
    expect(origins).toEqual([LEGACY_APP_ORIGIN, 'https://bon.exemple.com'])
    expect(rejected).toEqual(['app.exemple.com', '*'])
  })

  it('une absence ne se plaint pas — le cas NORMAL est silencieux', () => {
    expect(buildAllowedOrigins({ CORS_EXTRA_ORIGINS: '   ' } as NodeJS.ProcessEnv).rejected).toEqual([])
  })

  it('le joker n’est jamais une origine — `credentials: true` l’interdit de toute façon', () => {
    expect(normalizeOrigin('*')).toBeNull()
    expect(isOriginAllowed('https://n-importe-qui.vercel.app', ['*'])).toBe(false)
  })

  it('aucun motif : une prévisualisation Vercel reste refusée (site tiers = API du commerçant)', () => {
    expect(isOriginAllowed('https://habashop-git-truc.vercel.app', [LEGACY_APP_ORIGIN])).toBe(false)
  })
})

describe('CORS — la RÉPONSE HTTP réelle', () => {
  it('origine autorisée → en-tête renvoyé', async () => {
    expect(await origineRenvoyee(NEUVE, [LEGACY_APP_ORIGIN, NEUVE])).toBe(NEUVE)
  })

  it('origine inconnue → AUCUN en-tête (le navigateur bloque)', async () => {
    expect(await origineRenvoyee('https://pirate.exemple.com', [LEGACY_APP_ORIGIN])).toBeUndefined()
  })

  it('LE SCÉNARIO DU DÉFAUT : FRONTEND_URL avec barre finale → l’app répond quand même', async () => {
    // Avant ce module : la liste contenait `https://app.exemple.com/`, le navigateur envoyait
    // `https://app.exemple.com`, et l'application était vide sans message.
    const { origins } = buildAllowedOrigins({ FRONTEND_URL: `${NEUVE}/` } as NodeJS.ProcessEnv)
    expect(await origineRenvoyee(NEUVE, origins)).toBe(NEUVE)
  })

  it('localhost reste autorisé sur tout port (développement)', async () => {
    expect(await origineRenvoyee('http://localhost:5173', [LEGACY_APP_ORIGIN])).toBe('http://localhost:5173')
    expect(isLocalhostOrigin('http://127.0.0.1:3001')).toBe(true)
  })
})
