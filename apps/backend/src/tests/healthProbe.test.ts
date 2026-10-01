import { describe, it, expect, vi } from 'vitest'
import { sonderRedis, declarer, type EtatSonde } from '../lib/healthProbe'

/**
 * SONDE REDIS — mesurer au lieu de déclarer.
 *
 * ⚠️ `GET /api/health-extended` rendait `services.redis = { status: 'configured' }` : un champ
 * DÉCLARÉ qui reflétait la seule présence de `REDIS_URL`, jamais le fait que Redis réponde.
 * C'est le motif « le champ déclaré qui se fait passer pour une mesure » — et un signal qui ne
 * peut pas être faux coûte plus cher qu'un signal absent, parce qu'on s'y fie.
 *
 * ⚠️ L'enjeu a monté le 2026-10-01 : `POST /api/demo/start` est désormais FAIL-CLOSED sur
 * Redis. Si Redis tombe, le bouton « Essayer la démo » cesse de fonctionner — un exploitant
 * doit pouvoir le voir.
 *
 * ⚠️ TROIS états, jamais deux : `absent` (pas de `REDIS_URL` — une configuration, pas une
 * panne), `up`, `down`. Et tant que la sonde n'a pas répondu, on n'est pas optimiste.
 */

const attendre = (ms: number) => new Promise(r => setTimeout(r, ms))

describe('sonderRedis', () => {
  it('⚠️ client ABSENT → `absent`, PAS `down` — une configuration n’est pas une panne', async () => {
    const e = await sonderRedis(null, 50)
    expect(e.etat).toBe('absent')
    expect(e.latence).toBeUndefined()
  })

  it('PING qui répond → `up`, avec sa latence MESURÉE', async () => {
    const e = await sonderRedis({ ping: vi.fn(async () => 'PONG') }, 500)
    expect(e.etat).toBe('up')
    expect(typeof e.latence).toBe('number')
    expect(e.latence).toBeGreaterThanOrEqual(0)
  })

  it('⚠️ PING qui ÉCHOUE → `down`, et la raison est conservée', async () => {
    const e = await sonderRedis({ ping: vi.fn(async () => { throw new Error('ECONNREFUSED') }) }, 500)
    expect(e.etat).toBe('down')
    expect(String(e.raison)).toMatch(/ECONNREFUSED/)
  })

  it('⚠️ PING qui NE RÉPOND PAS → `down` par expiration, pas une attente infinie', async () => {
    const t0 = Date.now()
    const e = await sonderRedis({ ping: () => attendre(5_000).then(() => 'PONG') }, 120)
    expect(e.etat).toBe('down')
    expect(String(e.raison)).toMatch(/délai|timeout/i)
    expect(Date.now() - t0, 'la sonde doit rendre la main vite').toBeLessThan(1_500)
  })

  it('⚠️ une réponse INATTENDUE au PING n’est pas un succès', async () => {
    const e = await sonderRedis({ ping: vi.fn(async () => 'n importe quoi') }, 500)
    expect(e.etat).toBe('down')
  })

  it('⚠️ la sonde ne LÈVE JAMAIS — l’endpoint doit rapporter la panne, pas la propager', async () => {
    await expect(sonderRedis({ ping: () => { throw new Error('synchrone') } }, 100)).resolves.toMatchObject({ etat: 'down' })
  })
})

describe('declarer', () => {
  it('⚠️ le NOM dit sa nature : `declared`, jamais `status`', () => {
    expect(declarer(true)).toEqual({ declared: 'configured' })
    expect(declarer(false)).toEqual({ declared: 'absent' })
  })

  it('⚠️ et il n’emploie PAS le vocabulaire d’une sonde', () => {
    const v = JSON.stringify([declarer(true), declarer(false)])
    for (const mot of ['up', 'down', 'ok', 'healthy', 'status']) {
      expect(v, `« ${mot} » laisserait croire à une mesure`).not.toContain(`"${mot}"`)
    }
  })
})

describe('contrat de type', () => {
  it('les trois états sont exhaustifs — un quatrième ne compilerait pas', () => {
    const tous: EtatSonde[] = ['absent', 'up', 'down']
    expect(new Set(tous).size).toBe(3)
  })
})
