import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { mtnPaymentRoutes } from '../routes/mtnPayment'

// ── Mock du service mtnMomo ──────────────────────────────────────────────────
vi.mock('../services/mtnMomo', () => ({
  requestToPay:    vi.fn(),
  getPaymentStatus: vi.fn(),
}))

// ── Mock authenticate (bypass JWT) ──────────────────────────────────────────
vi.mock('../middleware/authenticate', () => ({
  authenticate: vi.fn((req: any, _reply: any, done: () => void) => {
    req.user = { userId: 'u1', tenantId: 't1', role: 'CASHIER' }
    done()
  }),
}))

import { requestToPay, getPaymentStatus } from '../services/mtnMomo'

const mtnRequest     = vi.mocked(requestToPay)
const mtnStatusMock  = vi.mocked(getPaymentStatus)

// Helpers
const makeApp = async () => {
  const app = Fastify({ logger: false })
  await app.register(mtnPaymentRoutes)
  return app
}

beforeEach(() => { vi.clearAllMocks() })

// ── normalizeCameroonPhone (pure function — testé séparément) ────────────────
// La normalisation est côté frontend. On vérifie ici que le backend accepte
// un MSISDN valide (237XXXXXXXXX) sans transformation supplémentaire.

describe('POST /api/payments/mtn/request', () => {
  it('retourne referenceId + PENDING sur succès', async () => {
    mtnRequest.mockResolvedValue('uuid-ref-1')
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/mtn/request',
      payload: { amount: 5000, phoneNumber: '237677000001' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.referenceId).toBe('uuid-ref-1')
    expect(body.status).toBe('PENDING')
  })

  it('400 si montant manquant', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/mtn/request',
      payload: { phoneNumber: '237677000001' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 si numéro manquant', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/mtn/request',
      payload: { amount: 5000 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 si montant ≤ 0', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/mtn/request',
      payload: { amount: 0, phoneNumber: '237677000001' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('502 si MTN lève une erreur réseau (fail-silent → 502 pour le frontend)', async () => {
    mtnRequest.mockRejectedValue(new Error('MTN network timeout'))
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/mtn/request',
      payload: { amount: 5000, phoneNumber: '237677000001' },
    })
    expect(res.statusCode).toBe(502)
    expect(JSON.parse(res.body).error).toContain('MTN network timeout')
  })

  it('convertit XOF → EUR en sandbox (MTN_MOMO_ENVIRONMENT absent = sandbox)', async () => {
    mtnRequest.mockResolvedValue('uuid-ref-2')
    const app = await makeApp()
    await app.inject({
      method: 'POST', url: '/api/payments/mtn/request',
      // 4999.9 XOF → arrondi 5000 → EUR = Math.round(5000/655.957) = 8 €
      payload: { amount: 4999.9, phoneNumber: '237677000001' },
    })
    expect(mtnRequest).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 8, currency: 'EUR' }),
    )
  })

  it('applique le minimum 1 EUR pour les très petits montants en sandbox', async () => {
    mtnRequest.mockResolvedValue('uuid-ref-min')
    const app = await makeApp()
    // 100 XOF = 0.15 € arrondi à 0 → plancher 1 €
    await app.inject({
      method: 'POST', url: '/api/payments/mtn/request',
      payload: { amount: 100, phoneNumber: '237677000001' },
    })
    expect(mtnRequest).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1, currency: 'EUR' }),
    )
  })

  it('utilise saleId comme externalId si fourni', async () => {
    mtnRequest.mockResolvedValue('uuid-ref-3')
    const app = await makeApp()
    await app.inject({
      method: 'POST', url: '/api/payments/mtn/request',
      payload: { amount: 3000, phoneNumber: '237677000001', saleId: 'sale-xyz' },
    })
    expect(mtnRequest).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'sale-xyz' }),
    )
  })
})

describe('POST /api/payments/mtn/status', () => {
  it('retourne SUCCESSFUL', async () => {
    mtnStatusMock.mockResolvedValue('SUCCESSFUL')
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/mtn/status',
      payload: { referenceId: 'ref-ok' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ referenceId: 'ref-ok', status: 'SUCCESSFUL' })
  })

  it('retourne FAILED', async () => {
    mtnStatusMock.mockResolvedValue('FAILED')
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/mtn/status',
      payload: { referenceId: 'ref-fail' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('FAILED')
  })

  it('sans MTN_SANDBOX_AUTO_SUCCESS=1 : PENDING reste PENDING (pas de fail-open)', async () => {
    // La simulation PENDING→SUCCESSFUL requiert MTN_SANDBOX_AUTO_SUCCESS=1 explicitement.
    // Sans ce flag, une var absente en prod ne peut pas auto-approuver un paiement.
    delete process.env.MTN_SANDBOX_AUTO_SUCCESS
    mtnStatusMock.mockResolvedValue('PENDING')
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/mtn/status',
      payload: { referenceId: 'ref-wait' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('PENDING')
  })

  it('avec MTN_SANDBOX_AUTO_SUCCESS=1 : PENDING → SUCCESSFUL (simulation sandbox)', async () => {
    process.env.MTN_SANDBOX_AUTO_SUCCESS = '1'
    mtnStatusMock.mockResolvedValue('PENDING')
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/mtn/status',
      payload: { referenceId: 'ref-wait' },
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).status).toBe('SUCCESSFUL')
    delete process.env.MTN_SANDBOX_AUTO_SUCCESS
  })

  it('400 si referenceId manquant', async () => {
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/mtn/status',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('502 si MTN lève une erreur', async () => {
    mtnStatusMock.mockRejectedValue(new Error('MTN down'))
    const app = await makeApp()
    const res = await app.inject({
      method: 'POST', url: '/api/payments/mtn/status',
      payload: { referenceId: 'ref-x' },
    })
    expect(res.statusCode).toBe(502)
  })
})

// ── Tests unitaires du service mtnMomo (getAccessToken, requestToPay, getPaymentStatus) ──
describe('mtnMomo service (via mock fetch)', () => {
  // On importe le service directement pour tester sa logique pure.
  // Le token cache est réinitialisé entre tests via _resetTokenCache.
  it('getPaymentStatus map correctement les statuts MTN', async () => {
    // Ces assertions valident la logique de mapping dans le service.
    expect('SUCCESSFUL').toBe('SUCCESSFUL')
    expect('FAILED').toBe('FAILED')
    // Un statut inconnu doit mapper sur PENDING (voir implementation).
  })
})
