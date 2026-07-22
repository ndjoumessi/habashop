import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { validatorCompiler } from 'fastify-type-provider-zod'

/**
 * Garde SERVEUR des boutiques de démonstration (`Tenant.isDemo`).
 *
 * Le mot de passe démo est PUBLIC (dépôt public, bundle JS, README) → n'importe qui
 * obtient un JWT MANAGER/ADMIN valide par `curl`. Masquer le bouton côté front ne
 * protège donc RIEN ; seul ce refus serveur ferme les actions qui coûtent de l'argent
 * (Anthropic, Twilio, Resend) ou qui détruisent des données.
 *
 * On monte les VRAIS handlers avec le VRAI garde (seuls `db`/`redis`/`authenticate`
 * sont mockés) et on prouve les deux sens :
 *   - boutique démo   → 403 `DEMO_TENANT_FORBIDDEN` (code explicite, pas un échec obscur)
 *   - boutique normale → le garde laisse passer, le handler s'exécute (contrôle positif)
 */

const { db, authMock } = vi.hoisted(() => ({
  db: { tenant: { findUnique: vi.fn(), create: vi.fn() }, $transaction: vi.fn() },
  authMock: vi.fn(async (req: any) => {
    req.user = { userId: 'u1', role: 'ADMIN', tenantId: 'T' }
    req.tenantId = 'T'
  }),
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../redis', () => ({ redis: null })) // pas de cache → chaque test contrôle la DB
vi.mock('../middleware/authenticate', () => ({ authenticate: authMock }))
vi.mock('../middleware/superAdmin', () => ({ authenticateAdmin: vi.fn() }))
vi.mock('twilio', () => ({ default: () => ({ messages: { create: vi.fn() } }) }))
vi.mock('cron', () => ({ CronJob: class { start() {} } }))

import { whatsappRoutes } from '../routes/whatsapp'
import { supplierRoutes } from '../routes/suppliers'
import { tenantRoutes } from '../routes/tenant'
import { isDemoTenant, DEMO_TENANT_FORBIDDEN } from '../middleware/demoTenant'

/** Le tenant courant est une démo (true) ou une boutique cliente (false). */
function seedTenant(isDemo: boolean) {
  db.tenant.findUnique.mockResolvedValue({ isDemo })
}

async function buildApp(register: any) {
  const app = Fastify()
  // Routes portant un `schema` zod → validatorCompiler AVANT register (sinon Ajv casse).
  app.setValidatorCompiler(validatorCompiler)
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_r, body: string, done) =>
    done(null, body ? JSON.parse(body) : {}))
  await app.register(register)
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.ANTHROPIC_API_KEY
})

describe('Garde boutique démo — OCR facture (coût Anthropic)', () => {
  it('boutique démo → 403 DEMO_TENANT_FORBIDDEN', async () => {
    seedTenant(true)
    const app = await buildApp(supplierRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/suppliers/scan-invoice' })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(DEMO_TENANT_FORBIDDEN)
  })

  it('boutique normale → le garde laisse passer (le handler répond 503, clé OCR absente)', async () => {
    seedTenant(false)
    const app = await buildApp(supplierRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/suppliers/scan-invoice' })
    // 503 = on a dépassé le garde ET le contrôle de rôle : le handler s'exécute bien.
    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBeUndefined()
  })
})

describe('Garde boutique démo — envoi WhatsApp (coût Twilio)', () => {
  const body = { phone: '+221771234567', items: [], total: 1000 }

  it('boutique démo → 403 DEMO_TENANT_FORBIDDEN', async () => {
    seedTenant(true)
    const app = await buildApp(whatsappRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/whatsapp/send-ticket', payload: body })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(DEMO_TENANT_FORBIDDEN)
  })

  it('boutique normale → le garde laisse passer (503 Twilio non configuré)', async () => {
    seedTenant(false)
    const app = await buildApp(whatsappRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/whatsapp/send-ticket', payload: body })
    expect(res.statusCode).not.toBe(403)
    expect(res.json().code).toBeUndefined()
  })

  it('la campagne marketing est gardée elle aussi', async () => {
    seedTenant(true)
    const app = await buildApp(whatsappRoutes)
    const res = await app.inject({
      method: 'POST', url: '/api/marketing/whatsapp/campaign',
      payload: { segment: 'all', message: 'promo' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(DEMO_TENANT_FORBIDDEN)
  })
})

describe('Évasion par création de boutique', () => {
  it('boutique démo → 403 sur POST /api/tenants (sinon le garde est contournable)', async () => {
    // Sans ce verrou : créer une boutique neuve (isDemo=false par défaut) puis basculer
    // dessus rendrait OCR et WhatsApp de nouveau accessibles en deux appels.
    seedTenant(true)
    const app = await buildApp(tenantRoutes)
    const res = await app.inject({ method: 'POST', url: '/api/tenants', payload: { name: 'Évasion' } })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe(DEMO_TENANT_FORBIDDEN)
    expect(db.tenant.create).not.toHaveBeenCalled()
  })
})

describe('isDemoTenant — fail-closed', () => {
  it('DB en erreur → considéré comme démo (on refuse plutôt que d’ouvrir)', async () => {
    db.tenant.findUnique.mockRejectedValue(new Error('DB down'))
    expect(await isDemoTenant('T')).toBe(true)
  })

  it('tenant introuvable → refusé', async () => {
    db.tenant.findUnique.mockResolvedValue(null)
    expect(await isDemoTenant('T')).toBe(true)
  })

  it('aucune boutique active → refusé', async () => {
    expect(await isDemoTenant(null)).toBe(true)
    expect(db.tenant.findUnique).not.toHaveBeenCalled()
  })

  it('boutique cliente → autorisée', async () => {
    seedTenant(false)
    expect(await isDemoTenant('T')).toBe(false)
  })
})
