import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ⚠️ SMS (Africa's Talking) — MÊMES deux gardes que WhatsApp : dépense (spendGuard) ET
// téléphone (resolveRecipient, la leçon la plus chère du repo). resolveRecipient est la
// VRAIE (pas mockée) : c'est précisément la sécurité qu'on veut exercer.

type Decision = { ok: boolean; quotaKey?: string; code?: string; message?: string }
const { smsSend, authorizeSpend, releaseQuota } = vi.hoisted(() => ({
  smsSend: vi.fn(),
  authorizeSpend: vi.fn(async (): Promise<Decision> => ({ ok: true, quotaKey: 'k' })),
  releaseQuota: vi.fn(async () => {}),
}))
vi.mock('africastalking', () => ({ default: () => ({ SMS: { send: smsSend } }) }))
vi.mock('../lib/spend/spendGuard', () => ({ authorizeSpend, releaseQuota }))

import { sendSms } from '../lib/spend/smsClient'

const OLD_ENV = { ...process.env }
beforeEach(() => {
  vi.clearAllMocks()
  authorizeSpend.mockResolvedValue({ ok: true, quotaKey: 'k' })
  smsSend.mockResolvedValue({ SMSMessageData: { Message: 'Sent', Recipients: [{ statusCode: 101, status: 'Success' }] } })
  process.env.SMS_API_KEY = 'test-key'
})
afterEach(() => { process.env = { ...OLD_ENV } })

describe('sendSms — garde téléphone (resolveRecipient réel)', () => {
  it('client, numéro NON international → écarté, aucune dépense, aucun envoi', async () => {
    const r = await sendSms({ tenantId: 'T', to: '0771234567', message: 'x', owner: { kind: 'customer' } })
    expect(r.sent).toBe(0)
    expect(r.refused?.[0].reason).toBe('PHONE_NOT_INTERNATIONAL')
    expect(authorizeSpend).not.toHaveBeenCalled()
    expect(smsSend).not.toHaveBeenCalled()
  })

  it('commerçant, pays NON supporté (France) → écarté (COUNTRY_UNKNOWN), aucun envoi', async () => {
    const r = await sendSms({ tenantId: 'T', to: '0771234567', message: 'x', owner: { kind: 'merchant', country: 'France' } })
    expect(r.refused?.[0].reason).toBe('COUNTRY_UNKNOWN')
    expect(smsSend).not.toHaveBeenCalled()
  })

  it('commerçant SN, numéro local (9 chiffres, sans 0 de tête) → normalisé et envoyé', async () => {
    // ⚠️ Le Sénégal n'a PAS de préfixe trunk 0 : le national fait 9 chiffres (77…). Un
    // '0771234567' serait INVALIDE (mesuré) — resolveRecipient le refuserait à raison.
    const r = await sendSms({ tenantId: 'T', to: '771234567', message: 'Stock bas', owner: { kind: 'merchant', country: 'SN' } })
    expect(smsSend).toHaveBeenCalledTimes(1)
    expect(smsSend.mock.calls[0][0].to).toEqual(['+221771234567'])
    expect(r.sent).toBe(1)
  })
})

describe('sendSms — garde de dépense', () => {
  it('quota refusé → denied, aucun envoi', async () => {
    authorizeSpend.mockResolvedValueOnce({ ok: false, code: 'QUOTA_EXCEEDED', message: 'plein' })
    const r = await sendSms({ tenantId: 'T', to: '+221771234567', message: 'x', owner: { kind: 'customer' } })
    expect(r.denied).toBe(true)
    expect(r.code).toBe('QUOTA_EXCEEDED')
    expect(smsSend).not.toHaveBeenCalled()
  })

  it('réserve pour le nombre RÉEL de destinataires (2)', async () => {
    smsSend.mockResolvedValueOnce({ SMSMessageData: { Message: 'Sent', Recipients: [{ statusCode: 101 }, { statusCode: 101 }] } })
    await sendSms({ tenantId: 'T', to: ['+221771234501', '+221771234502'], message: 'x', owner: { kind: 'customer' } })
    expect(authorizeSpend).toHaveBeenCalledWith('T', 'sms', 2)
  })
})

describe('sendSms — fail-safe clé absente', () => {
  it('SMS_API_KEY absente → SMS_NOT_CONFIGURED, failed=N, unités rendues', async () => {
    delete process.env.SMS_API_KEY
    const r = await sendSms({ tenantId: 'T', to: '+221771234567', message: 'x', owner: { kind: 'customer' } })
    expect(r.code).toBe('SMS_NOT_CONFIGURED')
    expect(r.failed).toBe(1)
    expect(r.sent).toBe(0)
    expect(releaseQuota).toHaveBeenCalledWith('T', 'sms', 1, 'k')
    expect(smsSend).not.toHaveBeenCalled()
  })
})
