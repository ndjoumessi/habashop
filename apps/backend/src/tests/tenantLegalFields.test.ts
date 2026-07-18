import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

// Identifiants légaux du tenant (pied de facture/devis) — noms alignés sur le
// frontend generateInvoice : ninea / rccm / vatNumber.
const { db } = vi.hoisted(() => ({
  db: { tenant: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../services/email', () => ({ sendUserInvitationEmail: vi.fn() }))
vi.mock('../middleware/authenticate', () => ({
  authenticate: async (req: any) => {
    req.user = { role: 'ADMIN', tenantId: 'T1', userId: 'u1' }
    req.tenantId = 'T1'
  },
}))

import { tenantRoutes } from '../routes/tenant'

async function buildApp() {
  const app = Fastify()
  await app.register(tenantRoutes)
  await app.ready()
  return app
}

const patch = (app: any, body: any) =>
  app.inject({ method: 'PATCH', url: '/api/tenant', headers: { 'content-type': 'application/json' }, payload: body })

beforeEach(() => {
  vi.clearAllMocks()
  db.tenant.update.mockResolvedValue({ id: 'T1' })
})

describe('PATCH /api/tenant — identifiants légaux (ninea / rccm / vatNumber)', () => {
  it('accepte et TRIM les 3 champs', async () => {
    const app = await buildApp()
    const res = await patch(app, { ninea: '  00123456 2G3  ', rccm: ' SN-DKR-2026-A-123 ', vatNumber: 'SN012345678' })
    expect(res.statusCode).toBe(200)
    const data = db.tenant.update.mock.calls[0][0].data
    expect(data.ninea).toBe('00123456 2G3')
    expect(data.rccm).toBe('SN-DKR-2026-A-123')
    expect(data.vatNumber).toBe('SN012345678')
  })

  it("chaîne vide → null (efface le champ, convention ownerPhone)", async () => {
    const app = await buildApp()
    const res = await patch(app, { ninea: '', rccm: '   ' })
    expect(res.statusCode).toBe(200)
    const data = db.tenant.update.mock.calls[0][0].data
    expect(data.ninea).toBeNull()
    expect(data.rccm).toBeNull()
    expect(data.vatNumber).toBeUndefined() // absent du body → intouché
  })

  it('champ absent du body → undefined (jamais écrasé par un update partiel)', async () => {
    const app = await buildApp()
    await patch(app, { name: 'Boutique X' })
    const data = db.tenant.update.mock.calls[0][0].data
    expect(data.ninea).toBeUndefined()
    expect(data.rccm).toBeUndefined()
    expect(data.vatNumber).toBeUndefined()
  })

  it('> 64 caractères → 400 VALIDATION, aucun update', async () => {
    const app = await buildApp()
    const res = await patch(app, { ninea: 'X'.repeat(65) })
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('VALIDATION')
    expect(db.tenant.update).not.toHaveBeenCalled()
  })

  it('type non-string → 400 VALIDATION', async () => {
    const app = await buildApp()
    const res = await patch(app, { vatNumber: 12345 })
    expect(res.statusCode).toBe(400)
    expect(db.tenant.update).not.toHaveBeenCalled()
  })
})
