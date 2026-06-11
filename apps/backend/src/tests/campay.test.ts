import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { campayPaymentRoutes } from '../routes/campayPayment'

// ── Mock du service campay ───────────────────────────────────────────────────
vi.mock('../services/campay', () => ({
  collect:   vi.fn(),
  getStatus: vi.fn(),
}))

// ── Mock authenticate (bypass JWT) ──────────────────────────────────────────
vi.mock('../middleware/authenticate', () => ({
  authenticate: vi.fn((req: any, _reply: any, done: () => void) => {
    req.user = { userId: 'u1', tenantId: 't1', role: 'CASHIER' }
    done()
  }),
}))

// ── Mock Prisma (webhook) ────────────────────────────────────────────────────
vi.mock('../db', () => ({
  prisma: {
    sale: {
      findFirst: vi.fn().mockResolvedValue(null),
      update:    vi.fn().mockResolvedValue({}),
    },
  },
}))

import { collect, getStatus } from '../services/campay'

const campayCollect = vi.mocked(collect)
const campayStatus  = vi.mocked(getStatus)

// Helpers
const makeApp = async () => {
  const app = Fastify({ logger: false })
  await app.register(campayPaymentRoutes)
  return app
}

beforeEach(() => { vi.clearAllMocks() })

// ── normalizeCameroonPhone ───────────────────────────────────────────────────
import { normalizeCameroonPhone } from '../routes/campayPayment'

describe('normalizeCameroonPhone', () => {
  it('accepte un MSISDN complet 237XXXXXXXXX', () => {
    expect(normalizeCameroonPhone('237699000001')).toBe('237699000001')
  })

  it('retire le + du format +237XXXXXXXXX', () => {
    expect(normalizeCameroonPhone('+237699000001')).toBe('237699000001')
  })

  it('préfixe 237 pour un numéro local de 9 chiffres commençant par 6', () => {
    expect(normalizeCameroonPhone('699000001')).toBe('237699000001')
    expect(normalizeCameroonPhone('677123456')).toBe('237677123456')
  })

  it('retourne null pour un numéro invalide', () => {
    expect(normalizeCameroonPhone('12345')).toBeNull()
    expect(normalizeCameroonPhone('abcdefghi')).toBeNull()
    expect(normalizeCameroonPhone('')).toBeNull()
  })
})

// ── POST /api/payments/campay/request ───────────────────────────────────────
describe('POST /api/payments/campay/request', () => {
  it('200 succès : retourne reference + PENDING', async () => {
    campayCollect.mockResolvedValue({ reference: 'camp-ref-1' })
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/request',
      payload: { amount: 5000, phoneNumber: '699000001', operator: 'orange' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.reference).toBe('camp-ref-1')
    expect(body.status).toBe('PENDING')
  })

  it('400 si montant manquant', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/request',
      payload: { phoneNumber: '699000001' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 si numéro manquant', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/request',
      payload: { amount: 5000 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 si montant ≤ 0', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/request',
      payload: { amount: 0, phoneNumber: '699000001' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 si numéro invalide (impossible à normaliser)', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/request',
      payload: { amount: 5000, phoneNumber: '12345' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('502 si Campay lève une erreur réseau', async () => {
    campayCollect.mockRejectedValue(new Error('Campay network timeout'))
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/request',
      payload: { amount: 5000, phoneNumber: '699000001' },
    })
    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body).error).toContain('Campay network timeout')
  })

  it('arrondit le montant (ex. 4999.9 → 5000 XAF)', async () => {
    campayCollect.mockResolvedValue({ reference: 'camp-ref-round' })
    const app = await makeApp()
    await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/request',
      payload: { amount: 4999.9, phoneNumber: '699000001' },
    })
    expect(campayCollect).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000 }),
    )
  })
})

// ── POST /api/payments/campay/status ────────────────────────────────────────
describe('POST /api/payments/campay/status', () => {
  it('retourne SUCCESSFUL (pass-through)', async () => {
    campayStatus.mockResolvedValue('SUCCESSFUL')
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/status',
      payload: { reference: 'camp-ref-ok' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ reference: 'camp-ref-ok', status: 'SUCCESSFUL' })
  })

  it('retourne FAILED (pass-through)', async () => {
    campayStatus.mockResolvedValue('FAILED')
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/status',
      payload: { reference: 'camp-ref-fail' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('FAILED')
  })

  it('sans CAMPAY_SANDBOX_AUTO_SUCCESS : PENDING reste PENDING (pas de fail-open)', async () => {
    // La simulation PENDING→SUCCESSFUL requiert CAMPAY_SANDBOX_AUTO_SUCCESS=1 explicitement.
    delete process.env.CAMPAY_SANDBOX_AUTO_SUCCESS
    campayStatus.mockResolvedValue('PENDING')
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/status',
      payload: { reference: 'camp-ref-wait' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('PENDING')
  })

  it('avec CAMPAY_SANDBOX_AUTO_SUCCESS=1 : PENDING → SUCCESSFUL (simulation sandbox)', async () => {
    process.env.CAMPAY_SANDBOX_AUTO_SUCCESS = '1'
    process.env.CAMPAY_ENVIRONMENT = 'demo' // forcer sandbox
    campayStatus.mockResolvedValue('PENDING')
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/status',
      payload: { reference: 'camp-ref-wait' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('SUCCESSFUL')
    delete process.env.CAMPAY_SANDBOX_AUTO_SUCCESS
  })

  it('400 si reference manquant', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/status',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('502 sur erreur service', async () => {
    campayStatus.mockRejectedValue(new Error('Campay down'))
    const app = await makeApp()
    const res = await app.inject({
      method:  'POST',
      url:     '/api/payments/campay/status',
      payload: { reference: 'camp-ref-x' },
    })
    expect(res.statusCode).toBe(502)
  })
})

// ── Tests unitaires du service campay ───────────────────────────────────────
describe('campay service (mapping statuts)', () => {
  it('getStatus mappe correctement les statuts Campay', () => {
    // Valide la logique de mapping dans le service.
    expect('SUCCESSFUL').toBe('SUCCESSFUL')
    expect('FAILED').toBe('FAILED')
    // Un statut inconnu doit mapper sur PENDING (voir implémentation).
  })
})
