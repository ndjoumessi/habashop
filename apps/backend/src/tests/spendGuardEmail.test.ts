import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Resend passe à son tour par le goulot — mais avec une distinction volontaire :
 *
 *  • e-mails OPÉRATIONNELS d'une boutique (invitation, alerte stock, rapport hebdo,
 *    récap paie) → GARDÉS ; c'est ce qu'un compte démo peut abuser ;
 *  • e-mails de CYCLE DE VIE SaaS (bienvenue, relances, essai expiré, confirmation)
 *    → EXEMPTS. Les garder bloquerait l'e-mail « votre essai est terminé » à l'instant
 *    précis où le tenant devient échu ou suspendu — le commerçant ne saurait jamais
 *    pourquoi son service s'est arrêté. L'exemption est testée pour qu'on ne la
 *    « corrige » pas par erreur plus tard.
 */

const { sendMock, tenantStore, redisMock } = vi.hoisted(() => ({
  sendMock: vi.fn(async () => ({ id: 'email_1' })),
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

process.env.RESEND_API_KEY = 'test-key'
vi.mock('resend', () => ({ Resend: class { emails = { send: sendMock } } }))
vi.mock('../redis', () => ({ redis: redisMock }))
vi.mock('../db', () => ({ prisma: { tenant: { findUnique: vi.fn(async () => tenantStore.current) } } }))
vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))

import { sendUserInvitationEmail, sendTrialExpired, sendStockAlertEmail } from '../services/email'

function seedTenant(over: Partial<{ isDemo: boolean; status: string; trialEnds: Date | null }> = {}) {
  tenantStore.current = { isDemo: false, status: 'active', trialEnds: null, ...over }
}

const INVITE = { tenantId: 'T', to: 'x@y.com', inviteeName: 'Awa', shopName: 'Boutique', tempPassword: 'p' }

beforeEach(() => {
  vi.clearAllMocks()
  seedTenant()
  redisMock.incrby.mockImplementation(async (key: string) => (String(key).startsWith('burst:') ? 1 : 1))
})

describe('E-mails opérationnels — gardés', () => {
  it('boutique DÉMO → invitation NON envoyée (vecteur de spam sous mot de passe public)', async () => {
    seedTenant({ isDemo: true })
    const ok = await sendUserInvitationEmail(INVITE)
    expect(ok).toBe(false)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('essai expiré → alerte stock NON envoyée', async () => {
    seedTenant({ status: 'trial', trialEnds: new Date(Date.now() - 86400000) })
    const ok = await sendStockAlertEmail({ tenantId: 'T', to: 'a@b.com', shopName: 'B', products: [] })
    expect(ok).toBe(false)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('boutique cliente saine → l’invitation part (contrôle positif)', async () => {
    const ok = await sendUserInvitationEmail(INVITE)
    expect(ok).toBe(true)
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('le quota e-mail est bien décompté', async () => {
    await sendUserInvitationEmail(INVITE)
    expect(redisMock.incrby).toHaveBeenCalledWith(expect.stringContaining('quota:email:T:'), 1)
  })
})

describe('E-mails de cycle de vie — volontairement EXEMPTS', () => {
  it('« essai expiré » part MÊME quand le tenant est suspendu', async () => {
    seedTenant({ status: 'suspended' })
    const ok = await sendTrialExpired({ to: 'a@b.com', shopName: 'B', ownerName: 'O' } as any)
    expect(ok).toBe(true)
    expect(sendMock).toHaveBeenCalledTimes(1) // sinon le client ignorerait pourquoi son accès s'arrête
  })

  it('ces envois ne consomment aucun quota de boutique', async () => {
    seedTenant({ status: 'suspended' })
    await sendTrialExpired({ to: 'a@b.com', shopName: 'B', ownerName: 'O' } as any)
    expect(redisMock.incrby).not.toHaveBeenCalled()
  })
})
