import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Câblage de la normalisation au POINT D'ENVOI.
 *
 * `phoneE164.test.ts` prouve que la fonction produit le bon numéro ; ce fichier prouve
 * qu'elle est réellement branchée sur le chemin qui dépense — la distinction exacte
 * qui manquait quand le méta-test semver restait vert alors que la prod renvoyait
 * `0.0.0-unknown`. On asserte donc le `to` REÇU PAR LE SDK, mocké : aucun envoi réel.
 */

const { createMock, tenantStore, redisMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  tenantStore: {
    current: null as { isDemo: boolean; status: string; trialEnds: Date | null; country: string | null } | null,
  },
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

import { sendWhatsApp } from '../lib/spend/twilioClient'

/** Le `to` effectivement remis au SDK Twilio (adresse `whatsapp:…`). */
const sentTo = (): string[] => createMock.mock.calls.map(c => String(c[0]?.to ?? ''))

function tenantIn(country: string | null) {
  tenantStore.current = { isDemo: false, status: 'active', trialEnds: null, country }
}

beforeEach(() => {
  vi.clearAllMocks()
  createMock.mockResolvedValue({ sid: 'SM_test' })
  tenantIn('SN')
  process.env.TWILIO_ACCOUNT_SID = 'AC'
  process.env.TWILIO_AUTH_TOKEN = 'tok'
  process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'
})

describe('Point d’envoi — le pays du tenant est réellement consulté', () => {
  it('numéro national du pays du tenant → E.164 correct', async () => {
    await sendWhatsApp({ tenantId: 'T', to: '77 123 45 67', body: 'x' })
    expect(sentTo()).toEqual(['whatsapp:+221771234567'])
  })

  it('le zéro de tête est traité selon le PAYS, pas selon une règle uniforme', async () => {
    tenantIn('CI')
    await sendWhatsApp({ tenantId: 'T', to: '0701234567', body: 'x' })
    expect(sentTo()).toEqual(['whatsapp:+2250701234567']) // zéro conservé

    vi.clearAllMocks()
    createMock.mockResolvedValue({ sid: 'SM_test' })
    tenantIn('GA')
    await sendWhatsApp({ tenantId: 'T', to: '062345678', body: 'x' })
    expect(sentTo()).toEqual(['whatsapp:+24162345678']) // zéro retiré
  })
})

describe('Point d’envoi — ANTI-FUITE de bout en bout', () => {
  /**
   * ⚠️ Le pendant, au niveau du SDK, du gardien de `phoneE164.test.ts` : un numéro
   * ivoirien chez un tenant marqué « SN » (le défaut SILENCIEUX du schéma) ne doit
   * JAMAIS partir vers un +221. C'est cette combinaison précise qui avait livré des
   * reçus à des tiers.
   */
  it('numéro ivoirien + tenant « SN » → aucun +221 n’atteint Twilio', async () => {
    await sendWhatsApp({ tenantId: 'T', to: '0701234567', body: 'x' })
    const to = sentTo()
    expect(to).toHaveLength(1)
    expect(to[0]).not.toContain('+221')
    expect(to[0]).toBe('whatsapp:+0701234567') // inchangé → Twilio rejettera (issue sûre)
  })

  it('pays non reconnu (« France », nom hérité d’Onboarding) → aucune réécriture', async () => {
    tenantIn('France')
    await sendWhatsApp({ tenantId: 'T', to: '771234567', body: 'x' })
    expect(sentTo()[0]).not.toContain('+221')
  })

  it('pays absent du cache (entrée écrite avant ce déploiement) → aucune réécriture', async () => {
    // Dégradation dans le sens sûr : pas de pays ⇒ pas de normalisation.
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ d: false, s: 'active', t: null }))
    await sendWhatsApp({ tenantId: 'T', to: '771234567', body: 'x' })
    expect(sentTo()[0]).not.toContain('+221')
  })

  it('un numéro déjà international n’est pas détourné par le pays du tenant', async () => {
    await sendWhatsApp({ tenantId: 'T', to: '+2250701234567', body: 'x' })
    expect(sentTo()).toEqual(['whatsapp:+2250701234567'])
  })
})

describe('Point d’envoi — la normalisation ne change rien au reste', () => {
  it('plusieurs destinataires : chacun normalisé, le compte des envois est inchangé', async () => {
    const res = await sendWhatsApp({ tenantId: 'T', to: ['771234567', '+33612345678', 'abc'], body: 'x' })
    expect(sentTo()).toEqual(['whatsapp:+221771234567', 'whatsapp:+33612345678', 'whatsapp:+abc'])
    expect(res.sent).toBe(3) // le SDK est mocké : c'est lui qui rejetterait 'abc' en réel
  })

  it('un refus de garde reste un refus — rien n’est envoyé', async () => {
    tenantStore.current = { isDemo: true, status: 'active', trialEnds: null, country: 'SN' }
    const res = await sendWhatsApp({ tenantId: 'demo', to: '771234567', body: 'x' })
    expect(createMock).not.toHaveBeenCalled()
    expect(res.denied).toBe(true)
  })
})
