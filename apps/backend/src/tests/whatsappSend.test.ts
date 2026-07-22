import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock du SDK twilio : capture les appels messages.create.
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))
vi.mock('twilio', () => ({ default: () => ({ messages: { create: createMock } }) }))
// Le garde de dépense résout le tenant : boutique cliente saine, quota libre.
vi.mock('../redis', () => ({ redis: null }))
vi.mock('../db', () => ({ prisma: { tenant: { findUnique: vi.fn(async () => ({ isDemo: false, status: 'active', trialEnds: null })) } } }))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { buildSaleMessage, sendSaleWhatsApp } from '../services/whatsappSend'

const SALE = { id: 'cmqABC123456', total: 5900, paymentMode: 'cash', createdAt: new Date('2026-06-06') }
const ITEMS = [{ qty: 2, total: 5900, product: { name: 'Bifaka' } }]
const CUSTOMER = { name: 'Awa', phone: '+221770000000' }
const TENANT = { id: 'T', name: 'Ma Boutique', currency: 'XOF', lang: 'fr', enableLoyalty: true, pointsPerAmount: 1000, enableAutoWhatsApp: true }

describe('buildSaleMessage', () => {
  it('contient boutique, article, total, paiement, points fidélité', () => {
    const msg = buildSaleMessage(SALE, ITEMS, CUSTOMER, TENANT).replace(/\s+/g, ' ') // normalise espaces (fins fr-FR)
    expect(msg).toContain('Ma Boutique')
    expect(msg).toContain('Bifaka')
    expect(msg).toContain('5 900 FCFA')   // total converti/formaté
    expect(msg).toContain('Espèces')      // paiement localisé
    expect(msg).toContain('+5 points fidélité') // floor(5900/1000) = 5 points
  })
  it('pas de ligne points si enableLoyalty=false', () => {
    const msg = buildSaleMessage(SALE, ITEMS, CUSTOMER, { ...TENANT, enableLoyalty: false })
    expect(msg).not.toMatch(/points fidélité/)
  })
})

describe('sendSaleWhatsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TWILIO_ACCOUNT_SID = 'ACxxxx'
    process.env.TWILIO_AUTH_TOKEN = 'tokxxxx'
    process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
    createMock.mockResolvedValue({ sid: 'SMxxxx' })
  })
  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID
    delete process.env.TWILIO_AUTH_TOKEN
    delete process.env.TWILIO_WHATSAPP_FROM
  })

  it('envoie si phone + toggle + config → true, to=whatsapp:phone', async () => {
    const ok = await sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, TENANT)
    expect(ok).toBe(true)
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      from: 'whatsapp:+14155238886',
      to: 'whatsapp:+221770000000',
      body: expect.stringContaining('Ma Boutique'),
    }))
  })

  it('pas d\'envoi si toggle désactivé', async () => {
    const ok = await sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, { ...TENANT, enableAutoWhatsApp: false })
    expect(ok).toBe(false)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('pas d\'envoi si client sans téléphone', async () => {
    const ok = await sendSaleWhatsApp(SALE, ITEMS, { name: 'X', phone: null }, TENANT)
    expect(ok).toBe(false)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('pas d\'envoi si config Twilio manquante (fail silencieux)', async () => {
    delete process.env.TWILIO_ACCOUNT_SID
    const ok = await sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, TENANT)
    expect(ok).toBe(false)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('échec Twilio → ne throw PAS (false), la vente n\'est pas bloquée', async () => {
    createMock.mockRejectedValue(new Error('Twilio 500'))
    await expect(sendSaleWhatsApp(SALE, ITEMS, CUSTOMER, TENANT)).resolves.toBe(false)
  })
})
