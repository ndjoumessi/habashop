import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * PLAFOND GLOBAL des créations de démo.
 *
 * ⚠️ Ce test existe parce que le test de la ROUTE mocke `demoQuota` en entier : sans lui,
 * la logique du plafond ne serait exercée par rien. Un module mocké partout est un module
 * non testé.
 *
 * ⚠️ Le cas décisif est `DEMO_QUOTA_PER_DAY='0'` : un `Number('0') || 200` rendrait la
 * désactivation inopérante — c'est le piège nommé par le CLAUDE.md sur les plafonds.
 */
const { redisMock, sentry } = vi.hoisted(() => ({
  redisMock: { valeur: null as null | { incr: unknown; expire: unknown } },
  sentry: { captureMessage: vi.fn() },
}))
vi.mock('../redis', () => ({ get redis() { return redisMock.valeur } }))
vi.mock('@sentry/node', () => sentry)

import { demoQuotaPerDay, reserveDemoSlot, DEMO_QUOTA_EXCEEDED } from '../lib/demoQuota'

/** Redis simulé : compteur réel par clé, pour que le plafond soit vraiment exercé. */
function redisCompteur() {
  const cles = new Map<string, number>()
  return {
    cles,
    client: {
      incr: vi.fn(async (k: string) => { cles.set(k, (cles.get(k) ?? 0) + 1); return cles.get(k)! }),
      expire: vi.fn(async () => 1),
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  redisMock.valeur = null
  delete process.env.DEMO_QUOTA_PER_DAY
})

describe('demoQuotaPerDay', () => {
  it('sans variable d’environnement, rend le défaut', () => {
    expect(demoQuotaPerDay({})).toBe(200)
  })

  it('lit la variable à l’APPEL — ajustable sans redéploiement', () => {
    expect(demoQuotaPerDay({ DEMO_QUOTA_PER_DAY: '42' })).toBe(42)
  })

  it('⚠️ DÉCISIF : « 0 » désactive réellement — pas de `|| défaut`', () => {
    expect(demoQuotaPerDay({ DEMO_QUOTA_PER_DAY: '0' })).toBe(0)
  })

  it('une valeur illisible retombe sur le défaut plutôt que sur NaN', () => {
    expect(demoQuotaPerDay({ DEMO_QUOTA_PER_DAY: 'beaucoup' })).toBe(200)
    expect(demoQuotaPerDay({ DEMO_QUOTA_PER_DAY: '-5' })).toBe(200)
  })

  it('une chaîne vide vaut « non renseigné », pas zéro', () => {
    expect(demoQuotaPerDay({ DEMO_QUOTA_PER_DAY: '   ' })).toBe(200)
  })
})

describe('reserveDemoSlot', () => {
  it('autorise sous le plafond et refuse au-delà — le compteur est réellement appliqué', async () => {
    const r = redisCompteur()
    redisMock.valeur = r.client
    process.env.DEMO_QUOTA_PER_DAY = '2'
    expect(await reserveDemoSlot(new Date('2026-10-01T10:00:00Z'))).toEqual({ ok: true, failOpen: false })
    expect(await reserveDemoSlot(new Date('2026-10-01T11:00:00Z'))).toEqual({ ok: true, failOpen: false })
    expect(await reserveDemoSlot(new Date('2026-10-01T12:00:00Z'))).toEqual({ ok: false, failOpen: false })
  })

  it('le compteur est PAR JOUR — le lendemain repart de zéro', async () => {
    const r = redisCompteur()
    redisMock.valeur = r.client
    process.env.DEMO_QUOTA_PER_DAY = '1'
    expect((await reserveDemoSlot(new Date('2026-10-01T10:00:00Z'))).ok).toBe(true)
    expect((await reserveDemoSlot(new Date('2026-10-01T23:00:00Z'))).ok).toBe(false)
    expect((await reserveDemoSlot(new Date('2026-10-02T00:30:00Z'))).ok).toBe(true)
  })

  it('pose une expiration au PREMIER incrément seulement — pas de TTL repoussé sans fin', async () => {
    const r = redisCompteur()
    redisMock.valeur = r.client
    process.env.DEMO_QUOTA_PER_DAY = '5'
    await reserveDemoSlot(new Date('2026-10-01T10:00:00Z'))
    await reserveDemoSlot(new Date('2026-10-01T11:00:00Z'))
    expect(r.client.expire).toHaveBeenCalledTimes(1)
  })

  it('⚠️ plafond à 0 : refus IMMÉDIAT, Redis n’est même pas sollicité', async () => {
    const r = redisCompteur()
    redisMock.valeur = r.client
    process.env.DEMO_QUOTA_PER_DAY = '0'
    expect(await reserveDemoSlot(new Date())).toEqual({ ok: false, failOpen: false })
    expect(r.client.incr).not.toHaveBeenCalled()
  })

  it('⚠️ Redis ABSENT → fail-OPEN, et c’est TRACÉ', async () => {
    redisMock.valeur = null
    expect(await reserveDemoSlot(new Date())).toEqual({ ok: true, failOpen: true })
    expect(sentry.captureMessage).toHaveBeenCalled()
  })

  it('⚠️ Redis en ÉCHEC → fail-OPEN, et c’est TRACÉ', async () => {
    redisMock.valeur = { incr: vi.fn(async () => { throw new Error('ECONNRESET') }), expire: vi.fn() }
    expect(await reserveDemoSlot(new Date())).toEqual({ ok: true, failOpen: true })
    expect(sentry.captureMessage).toHaveBeenCalled()
  })

  it('le code de refus est explicite', () => {
    expect(DEMO_QUOTA_EXCEEDED).toBe('DEMO_QUOTA_EXCEEDED')
  })
})
