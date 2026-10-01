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
  redisMock: { valeur: null as null | Record<string, unknown> },
  sentry: { captureMessage: vi.fn() },
}))
vi.mock('../redis', () => ({ get redis() { return redisMock.valeur } }))
vi.mock('@sentry/node', () => sentry)

import { demoQuotaPerDay, reserveDemoSlot, releaseDemoSlot, DEMO_QUOTA_EXCEEDED } from '../lib/demoQuota'

/** Redis simulé : compteur réel par clé, pour que le plafond soit vraiment exercé. */
function redisCompteur() {
  const cles = new Map<string, number>()
  return {
    cles,
    client: {
      incr: vi.fn(async (k: string) => { cles.set(k, (cles.get(k) ?? 0) + 1); return cles.get(k) ?? 0 }),
      decr: vi.fn(async (k: string) => { cles.set(k, Math.max(0, (cles.get(k) ?? 0) - 1)); return cles.get(k) ?? 0 }),
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
    expect(await reserveDemoSlot(new Date('2026-10-01T10:00:00Z'))).toEqual({ ok: true, failClosed: false })
    expect(await reserveDemoSlot(new Date('2026-10-01T11:00:00Z'))).toEqual({ ok: true, failClosed: false })
    expect(await reserveDemoSlot(new Date('2026-10-01T12:00:00Z'))).toEqual({ ok: false, failClosed: false })
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
    expect(await reserveDemoSlot(new Date())).toEqual({ ok: false, failClosed: false })
    expect(r.client.incr).not.toHaveBeenCalled()
  })

  /**
   * ⚠️ FAIL-CLOSED, ET C'EST UN RENVERSEMENT ASSUMÉ.
   *
   * La première version faisait fail-OPEN, justifié par « le plafond par IP tient toujours ».
   * La revue a montré que ce repli N'EXISTE PAS : Fastify tourne avec `trustProxy: true`
   * (`server.ts:111`), donc `request.ip` est lu dans `X-Forwarded-For`, un en-tête que
   * l'appelant contrôle entièrement. Une boucle `curl` qui fait varier cet en-tête obtient
   * une clé de rate-limit différente à chaque requête et n'atteint jamais les 20/h.
   *
   * Sans Redis, un fail-open laissait donc la création de tenants bornée par RIEN : des
   * milliers de tenants, des millions de lignes, jusqu'à saturation du disque Postgres de
   * PRODUCTION. La démo est une commodité ; la base de production ne l'est pas.
   *
   * ⚠️ C'est la même erreur que celle du `notify-failure` sortant en `exit 0` : deux gardes
   * qui se citent mutuellement comme filet, et aucun des deux ne tient seul.
   */
  it('⚠️ Redis ABSENT → fail-CLOSED, et c’est TRACÉ', async () => {
    redisMock.valeur = null
    expect(await reserveDemoSlot(new Date())).toEqual({ ok: false, failClosed: true })
    expect(sentry.captureMessage).toHaveBeenCalled()
  })

  it('⚠️ Redis en ÉCHEC → fail-CLOSED, et c’est TRACÉ', async () => {
    redisMock.valeur = { incr: vi.fn(async () => { throw new Error('ECONNRESET') }), expire: vi.fn() }
    expect(await reserveDemoSlot(new Date())).toEqual({ ok: false, failClosed: true })
    expect(sentry.captureMessage).toHaveBeenCalled()
  })

  /**
   * ⚠️ Le créneau est rendu quand la création ÉCHOUE.
   *
   * Sans cela, une régression du jeu de données (ou un pool de connexions saturé) consommait
   * les 200 créneaux de la journée sur des créations avortées, et le bouton annonçait
   * « le nombre de démonstrations ouvertes aujourd'hui est atteint » alors que ZÉRO démo
   * n'existait. Le compteur mentait sur ce qu'il mesure.
   */
  it('⚠️ `releaseDemoSlot` rend le créneau — un échec ne consomme pas la journée', async () => {
    const r = redisCompteur()
    redisMock.valeur = r.client
    process.env.DEMO_QUOTA_PER_DAY = '1'
    const t = new Date('2026-10-01T10:00:00Z')
    expect((await reserveDemoSlot(t)).ok).toBe(true)
    await releaseDemoSlot(t)
    // Le créneau rendu, la démo suivante repasse.
    expect((await reserveDemoSlot(t)).ok).toBe(true)
  })

  it('⚠️ rendre un créneau ne descend JAMAIS sous zéro', async () => {
    const r = redisCompteur()
    redisMock.valeur = r.client
    await releaseDemoSlot(new Date('2026-10-01T10:00:00Z'))
    expect(r.cles.get('demo:start:2026-10-01') ?? 0).toBeGreaterThanOrEqual(0)
  })

  it('rendre un créneau sans Redis ne lève pas', async () => {
    redisMock.valeur = null
    await expect(releaseDemoSlot(new Date())).resolves.toBeUndefined()
  })

  it('le code de refus est explicite', () => {
    expect(DEMO_QUOTA_EXCEEDED).toBe('DEMO_QUOTA_EXCEEDED')
  })
})
