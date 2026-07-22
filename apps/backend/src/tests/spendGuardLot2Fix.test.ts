import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Revue lots 1-2 — correctifs #1, #5, #8, #9.
 *
 * Fil commun : le client unifié avalait et aplatissait ce que les routes savaient
 * distinguer. Chaque test asserte le RÉSULTAT (numéro produit, comptage, code d'erreur,
 * contenu des logs), jamais la simple absence d'exception.
 */

const { createMock, tenantStore, redisMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  tenantStore: { current: null as any },
  redisMock: {
    get:    vi.fn(async (_k: string) => null as string | null),
    setex:  vi.fn(async (_k: string, _t: number, _v: string) => 'OK'),
    del:    vi.fn(async (..._k: string[]) => 1),
    incrby: vi.fn(async (_k: string, _by: number) => 1),
    decrby: vi.fn(async (_k: string, _by: number) => 0),
    expire: vi.fn(async (_k: string, _t: number) => 1),
  },
}))
vi.mock('twilio', () => ({ default: () => ({ messages: { create: createMock } }) }))
vi.mock('../redis', () => ({ redis: redisMock }))
vi.mock('../db', () => ({ prisma: { tenant: { findUnique: vi.fn(async () => tenantStore.current) } } }))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { sendWhatsApp, TWILIO_NOT_CONFIGURED } from '../lib/spend/twilioClient'
import { toE164, maskPhone } from '../lib/spend/phone'

const OK_TWILIO = () => {
  process.env.TWILIO_ACCOUNT_SID = 'AC_test'
  process.env.TWILIO_AUTH_TOKEN = 'tok'
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
}

beforeEach(() => {
  vi.clearAllMocks()
  tenantStore.current = { isDemo: false, status: 'active', trialEnds: null }
  redisMock.incrby.mockImplementation(async (k: string) => (String(k).startsWith('burst:') ? 1 : 1))
  createMock.mockResolvedValue({ sid: 'SM1' })
  OK_TWILIO()
})

// ── #1 ────────────────────────────────────────────────────────────────────────
describe('#1 — normalisation : un format national ressort en E.164 complet', () => {
  it('« 077 123 4567 » (Sénégal) → +221771234567', () => {
    expect(toE164('077 123 4567', 'SN')).toBe('+221771234567')
  })

  it('l’ancien comportement produisait +771234567 : sans indicatif, donc invalide', () => {
    // Preuve que le correctif ne se contente pas de « remettre l'ancien code ».
    const ancien = '+' + '077 123 4567'.replace(/[\s\-()]/g, '').replace(/^0/, '')
    expect(ancien).toBe('+771234567')
    expect(toE164('077 123 4567', 'SN')).not.toBe(ancien)
  })

  it('respecte le pays de la boutique (Côte d’Ivoire → 225)', () => {
    expect(toE164('07 12 34 56 78', 'CI')).toBe('+2250712345678')
  })

  it('laisse intact un numéro déjà international, quelle que soit sa forme', () => {
    expect(toE164('+221 77 000 01 01', 'SN')).toBe('+221770000101')
    expect(toE164('00221770000101', 'SN')).toBe('+221770000101')
    expect(toE164('221770000101', 'SN')).toBe('+221770000101')
  })

  it('rend null sur un numéro inexploitable (au lieu d’un +… bancal)', () => {
    expect(toE164('', 'SN')).toBeNull()
    expect(toE164('abc', 'SN')).toBeNull()
    expect(toE164(null, 'SN')).toBeNull()
  })

  it('broadcast et campagne traitent un même numéro À L’IDENTIQUE', async () => {
    // Les deux routes passent désormais par sendWhatsApp sans normaliser en amont :
    // même entrée → même adresse Twilio.
    await sendWhatsApp({ tenantId: 'T', to: ['077 123 4567'], body: 'broadcast', country: 'SN' })
    const viaBroadcast = createMock.mock.calls[0][0].to

    vi.clearAllMocks(); createMock.mockResolvedValue({ sid: 'SM2' })
    redisMock.incrby.mockImplementation(async (k: string) => (String(k).startsWith('burst:') ? 1 : 1))
    await sendWhatsApp({ tenantId: 'T', to: ['077 123 4567'], body: 'campagne', country: 'SN' })
    const viaCampagne = createMock.mock.calls[0][0].to

    expect(viaBroadcast).toBe('whatsapp:+221771234567')
    expect(viaCampagne).toBe(viaBroadcast)
  })
})

// ── #5 ────────────────────────────────────────────────────────────────────────
describe('#5 — Twilio non configuré : failed == N, jamais 0', () => {
  it('180 destinataires jamais contactés → failed = 180', async () => {
    delete process.env.TWILIO_WHATSAPP_FROM
    const phones = Array.from({ length: 180 }, (_, i) => `+22177000${String(i).padStart(4, '0')}`)
    const res = await sendWhatsApp({ tenantId: 'T', to: phones, body: 'promo', country: 'SN' })

    expect(res.sent).toBe(0)
    expect(res.failed).toBe(180)        // ← et non 0
    expect(res.skipped).toBe(180)
    expect(res.code).toBe(TWILIO_NOT_CONFIGURED)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('les unités réservées sont rendues (rien n’est parti)', async () => {
    delete process.env.TWILIO_WHATSAPP_FROM
    redisMock.incrby.mockImplementation(async (k: string) => (String(k).startsWith('burst:') ? 1 : 3))
    await sendWhatsApp({ tenantId: 'T', to: ['+221770000001', '+221770000002', '+221770000003'], body: 'x' })
    expect(redisMock.decrby).toHaveBeenCalledWith(expect.stringContaining('quota:whatsapp:T:'), 3)
  })

  it('un envoi partiel compte exactement : 2 envoyés, 1 échoué', async () => {
    createMock
      .mockResolvedValueOnce({ sid: 'SM1' })
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 21614 }))
      .mockResolvedValueOnce({ sid: 'SM3' })
    const res = await sendWhatsApp({ tenantId: 'T', to: ['+221770000001', '+221770000002', '+221770000003'], body: 'x' })
    expect(res.sent).toBe(2)
    expect(res.failed).toBe(1)
    expect(res.skipped).toBe(0)
    expect(res.results.filter(r => r.ok)).toHaveLength(2)
  })

  it('un numéro inexploitable est compté comme échec, pas ignoré en silence', async () => {
    const res = await sendWhatsApp({ tenantId: 'T', to: ['+221770000001', 'abc'], body: 'x' })
    expect(res.sent).toBe(1)
    expect(res.failed).toBe(1)
    expect(res.skipped).toBe(1)
  })
})

// ── #8 ────────────────────────────────────────────────────────────────────────
describe('#8 — un vrai code Twilio remonte jusqu’à l’appelant', () => {
  it('21608 (numéro pas sur WhatsApp) est exposé dans le résultat', async () => {
    createMock.mockRejectedValue(Object.assign(new Error('not a WhatsApp user'), { code: 21608 }))
    const res = await sendWhatsApp({ tenantId: 'T', to: '+221770000001', body: 'x' })
    expect(res.sent).toBe(0)
    expect(res.errorCode).toBe(21608)                 // ← la route peut mapper le message
    expect(res.results[0].errorCode).toBe(21608)
  })

  it('20003 (authentification) remonte aussi, distinct d’un simple échec', async () => {
    createMock.mockRejectedValue(Object.assign(new Error('auth failed'), { code: 20003 }))
    const res = await sendWhatsApp({ tenantId: 'T', to: '+221770000001', body: 'x' })
    expect(res.errorCode).toBe(20003)
  })

  it('la table de messages de la route couvre bien ces codes', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const src = readFileSync(join(__dirname, '..', 'routes', 'whatsapp.ts'), 'utf8')
    expect(src).toContain('TWILIO_ERRORS')
    expect(src).toMatch(/21608:\s*"Ce numéro n'est pas inscrit sur WhatsApp"/)
    // et elle est atteinte via errorCode, pas depuis un catch devenu mort
    expect(src).toContain('TWILIO_ERRORS[failure.errorCode]')
  })
})

// ── #9 ────────────────────────────────────────────────────────────────────────
describe('#9 — aucun numéro de téléphone dans les journaux', () => {
  it('un échec Twilio ne logge PAS le numéro destinataire', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createMock.mockRejectedValue(Object.assign(
      new Error("The 'To' number whatsapp:+221771234567 is not a valid phone number"),
      { code: 21211 },
    ))
    await sendWhatsApp({ tenantId: 'T', to: '+221771234567', body: 'x' })

    const logged = warn.mock.calls.flat().map(String).join(' | ')
    expect(logged).not.toContain('221771234567')   // le numéro complet
    expect(logged).not.toContain('771234567')      // le numéro national
    expect(logged).toContain('21211')              // le code d'erreur, lui, reste utile
    warn.mockRestore()
  })

  it('maskPhone conserve la fin du numéro pour le support, pas le numéro', () => {
    expect(maskPhone("The 'To' number whatsapp:+221771234567 is invalid"))
      .not.toContain('221771234567')
    expect(maskPhone('+221771234567')).toContain('4567')
  })

  it('AUCUN log de ce module ne contient une suite de 9+ chiffres', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createMock.mockRejectedValue(Object.assign(new Error('to +221770000001 failed'), { code: 21211 }))
    await sendWhatsApp({ tenantId: 'T', to: ['+221770000001', '+221770000002'], body: 'x' })

    const logged = warn.mock.calls.flat().map(String).join(' | ')
    expect(logged).not.toMatch(/\d{9,}/)
    warn.mockRestore()
  })
})
