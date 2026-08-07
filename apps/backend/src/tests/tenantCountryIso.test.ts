import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import { normalizeCountry, isIsoCountry, SUPPORTED_COUNTRIES } from '../lib/country'

// ⚠️ `Tenant.country` — UNE seule représentation : ISO-3166-1 alpha-2.
//
// Mesuré en prod avant correctif : `SN`×2, `CI`×1 et **`France`**×1. Deux surfaces écrivaient
// le champ dans deux formats — `SignupPage` en ISO-2, `Onboarding` en LIBELLÉ FRANÇAIS (il
// PATCHait la `value` de son propre `<select>`) — sans validation au milieu.
//
// Ce n'est pas cosmétique : `resolveRecipient` ne normalise le téléphone d'un COMMERÇANT qu'à
// partir de son pays, et écarte tout ce qui n'est pas ISO-2 (`COUNTRY_UNKNOWN`). Un tenant
// « France » ne reçoit donc NI WhatsApp NI SMS, silencieusement. Le garde téléphonique fait
// son travail ; c'est la donnée qui ment.

describe('normalizeCountry — ISO-2 ou rien', () => {
  it('accepte un ISO-2 servi, quelle que soit la casse', () => {
    expect(normalizeCountry('SN')).toBe('SN')
    expect(normalizeCountry('ci')).toBe('CI')
    expect(normalizeCountry('  cm  ')).toBe('CM')
  })

  it('convertit les LIBELLÉS HÉRITÉS de l’ancien sélecteur (PWA en cache)', () => {
    // Ensemble CLOS : ce sont nos propres anciennes `value`, pas une inférence sur du texte libre.
    expect(normalizeCountry('France')).toBe('FR')
    expect(normalizeCountry('Sénégal')).toBe('SN')
    expect(normalizeCountry('Senegal')).toBe('SN')       // sans accent
    expect(normalizeCountry("Côte d'Ivoire")).toBe('CI')
    expect(normalizeCountry('Congo RDC')).toBe('CD')
  })

  // ⚠️ LE point qui distingue une liste blanche d'une regex `^[A-Z]{2}$`.
  it('REFUSE un code à 2 lettres qui ne désigne aucun pays servi', () => {
    expect(normalizeCountry('XX')).toBeNull()
    expect(normalizeCountry('ZZ')).toBeNull()
    // Une regex les aurait acceptés : on aurait remplacé une valeur invalide BRUYANTE
    // (« France », visible) par une valeur invalide SILENCIEUSE (« XX », plausible).
  })

  it('REFUSE le vide, le non-string et l’inconnu — jamais de repli implicite', () => {
    for (const v of ['', '   ', null, undefined, 42 as unknown as string, 'Sénégalais', 'Autre']) {
      expect(normalizeCountry(v as string)).toBeNull()
    }
    // « Autre » figurait dans l'ancien sélecteur : il ne désigne aucun pays, il ne doit donc
    // RIEN normaliser. Le convertir en 'SN' recréerait le défaut silencieux à l'origine du bug.
  })

  it('ne renvoie jamais un pays DEVINÉ : null signifie « on ne sait pas »', () => {
    // Un repli sur 'SN' ici rendrait indistinguables un choix et un défaut — c'est
    // exactement ce qui fait qu'un tenant ivoirien est stocké « Sénégal » en base.
    expect(normalizeCountry('Pays inconnu')).toBeNull()
  })

  it('isIsoCountry n’accepte QUE la forme déjà canonique', () => {
    expect(isIsoCountry('SN')).toBe(true)
    expect(isIsoCountry('France')).toBe(false)   // normalisable, mais pas canonique
    expect(isIsoCountry('XX')).toBe(false)
  })

  it('la liste blanche ne contient que des codes à 2 lettres majuscules, sans doublon', () => {
    for (const c of SUPPORTED_COUNTRIES) expect(c).toMatch(/^[A-Z]{2}$/)
    expect(new Set(SUPPORTED_COUNTRIES).size).toBe(SUPPORTED_COUNTRIES.length)
  })

  it('tout libellé hérité se normalise vers un pays RÉELLEMENT servi (pas de cible orpheline)', () => {
    for (const label of ['France', 'Sénégal', "Côte d'Ivoire", 'Cameroun', 'Gabon', 'Canada', 'Belgique']) {
      const iso = normalizeCountry(label)
      expect(iso).not.toBeNull()
      expect(SUPPORTED_COUNTRIES).toContain(iso!)
    }
  })
})

// ── La route : c'est elle qui a écrit « France » en base ─────────────────────────
const { db } = vi.hoisted(() => ({
  db: {
    tenant: { update: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },   // la route trace désormais les changements de locale
  },
}))
vi.mock('../db', () => ({ prisma: db, basePrisma: db }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: Record<string, unknown>) => { req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1' }; req.tenantId = 'T1' },
}))
vi.mock('../lib/writeAudit', () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../lib/cache', () => ({ invalidateTenantCache: vi.fn().mockResolvedValue(undefined) }))

import { tenantRoutes } from '../routes/tenant'

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.update.mockResolvedValue({ id: 'T1' })
  db.tenant.findUnique.mockResolvedValue({ id: 'T1', country: 'SN' })
})

const patch = async (body: Record<string, unknown>) => {
  const app = Fastify()
  await app.register(tenantRoutes)
  await app.ready()
  return app.inject({ method: 'PATCH', url: '/api/tenant', payload: body })
}

describe('PATCH /api/tenant — country', () => {
  it('un LIBELLÉ est converti en ISO-2 avant écriture (jamais stocké tel quel)', async () => {
    const res = await patch({ country: 'France' })
    expect(res.statusCode).toBe(200)
    expect(db.tenant.update.mock.calls.at(-1)![0].data.country).toBe('FR')
  })

  it('un ISO-2 passe inchangé', async () => {
    await patch({ country: 'CM' })
    expect(db.tenant.update.mock.calls.at(-1)![0].data.country).toBe('CM')
  })

  it('une valeur non résolvable → 400, et AUCUNE écriture', async () => {
    const res = await patch({ country: 'Pays imaginaire' })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('VALIDATION')
    expect(db.tenant.update).not.toHaveBeenCalled()   // refuser vaut mieux qu'inventer
  })

  it('`country` absent du body : le champ n’est pas touché (PATCH partiel)', async () => {
    await patch({ name: 'Boutique' })
    expect(db.tenant.update.mock.calls.at(-1)![0].data.country).toBeUndefined()
  })
})
