import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * PURGE DES DÉMOS JETABLES.
 *
 * ⚠️ LE TEST DÉCISIF est « un tenant à `demoExpiresAt` nul n'est JAMAIS sélectionné » :
 * c'est lui qui protège demo-tenant-001/002 et e2e-tenant. Ils sont protégés par une
 * PROPRIÉTÉ (colonne nulle), pas par une liste de noms qui vieillirait.
 *
 * ⚠️ Le mock APPLIQUE le filtre `where` : un `mockResolvedValue([…])` rendrait la même liste
 * quel que soit le filtre, et resterait vert même si le code cessait d'envoyer la condition
 * d'échéance — un vert qui décrit un monde qui n'existe pas.
 */
const { db, purge, sentry } = vi.hoisted(() => ({
  db: { tenant: { findMany: vi.fn() }, $transaction: vi.fn() },
  purge: { hardDeleteTenant: vi.fn() },
  sentry: { captureMessage: vi.fn(), captureException: vi.fn() },
}))
vi.mock('../db', () => ({ prisma: db }))
vi.mock('../lib/tenantPurge', async (orig) => ({ ...(await orig() as object), ...purge }))
vi.mock('@sentry/node', () => sentry)

import { runDemoPurge } from '../services/demoPurge'

const MAINTENANT = new Date('2026-10-20T03:00:00.000Z')

interface TenantSimule { id: string; demoExpiresAt: Date | null; isDemo: boolean }

/** Base simulée : le `findMany` APPLIQUE réellement le filtre reçu. */
function seed(tenants: TenantSimule[]) {
  db.tenant.findMany.mockImplementation(async (args: { where: Record<string, any> }) => {
    const where = args.where
    return tenants.filter(t => {
      if (where.isDemo !== undefined && t.isDemo !== where.isDemo) return false
      const cond = where.demoExpiresAt
      if (cond?.not === null && t.demoExpiresAt === null) return false
      if (cond?.lt !== undefined && !(t.demoExpiresAt !== null && t.demoExpiresAt < cond.lt)) return false
      return true
    }).map(t => ({ id: t.id }))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  purge.hardDeleteTenant.mockResolvedValue({ Sale: 3 })
  db.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(db))
})

describe('runDemoPurge', () => {
  it('supprime une démo jetable dont l’échéance est dépassée', async () => {
    seed([{ id: 'demo-tmp-a', demoExpiresAt: new Date('2026-10-10T00:00:00Z'), isDemo: true }])
    const r = await runDemoPurge(MAINTENANT)
    expect(r.supprimes).toBe(1)
    expect(purge.hardDeleteTenant).toHaveBeenCalledWith(expect.anything(), 'demo-tmp-a')
  })

  it('ne touche PAS une démo jetable encore valide', async () => {
    seed([{ id: 'demo-tmp-b', demoExpiresAt: new Date('2026-10-25T00:00:00Z'), isDemo: true }])
    const r = await runDemoPurge(MAINTENANT)
    expect(r.supprimes).toBe(0)
    expect(purge.hardDeleteTenant).not.toHaveBeenCalled()
  })

  it('un tenant à `demoExpiresAt` NUL n’est pas sélectionné (sémantique SQL des NULL)', async () => {
    seed([
      { id: 'demo-tenant-001', demoExpiresAt: null, isDemo: true },
      { id: 'demo-tenant-002', demoExpiresAt: null, isDemo: true },
      { id: 'e2e-tenant', demoExpiresAt: null, isDemo: false },
    ])
    const r = await runDemoPurge(MAINTENANT)
    expect(r.supprimes).toBe(0)
    expect(purge.hardDeleteTenant).not.toHaveBeenCalled()
  })

  it('⚠️ le filtre exige EXPLICITEMENT une échéance non nulle et dépassée', async () => {
    seed([])
    await runDemoPurge(MAINTENANT)
    const appel = db.tenant.findMany.mock.calls[0]
    const where = (appel[0] as { where: Record<string, unknown> }).where
    expect(where.demoExpiresAt).toMatchObject({ not: null, lt: MAINTENANT })
    expect(where.isDemo).toBe(true)
  })

  it('un échec sur une démo n’empêche pas les suivantes, et il est COMPTÉ', async () => {
    seed([
      { id: 'demo-tmp-x', demoExpiresAt: new Date('2026-10-01T00:00:00Z'), isDemo: true },
      { id: 'demo-tmp-y', demoExpiresAt: new Date('2026-10-02T00:00:00Z'), isDemo: true },
    ])
    purge.hardDeleteTenant.mockRejectedValueOnce(new Error('FK'))
    const r = await runDemoPurge(MAINTENANT)
    expect(r.examines).toBe(2)
    expect(r.supprimes).toBe(1)
    expect(r.echecs).toBe(1)
  })

  it('⚠️ un échec PART en Sentry — un console.error seul n’atteint personne', async () => {
    seed([{ id: 'demo-tmp-z', demoExpiresAt: new Date('2026-10-01T00:00:00Z'), isDemo: true }])
    purge.hardDeleteTenant.mockRejectedValueOnce(new Error('FK'))
    await runDemoPurge(MAINTENANT)
    expect(sentry.captureException).toHaveBeenCalled()
  })

  it('⚠️ IDEMPOTENTE : une passe interrompue est reprise par la suivante', async () => {
    seed([{ id: 'demo-tmp-w', demoExpiresAt: new Date('2026-10-01T00:00:00Z'), isDemo: true }])
    purge.hardDeleteTenant.mockRejectedValueOnce(new Error('timeout'))
    const p1 = await runDemoPurge(MAINTENANT)
    expect(p1.echecs).toBe(1)
    // Le tenant est toujours là, échéance toujours dépassée → la passe suivante le retrouve.
    const p2 = await runDemoPurge(MAINTENANT)
    expect(p2.supprimes).toBe(1)
  })

  /**
   * ⚠️ LE TEST VRAIMENT DÉCISIF.
   *
   * Le test précédent ne discrimine PAS : en SQL, `demoExpiresAt < now` exclut déjà les
   * NULL, donc `lt` seul protège les démos permanentes — retirer `not: null` le laissait
   * VERT (mesuré : 1 rouge au lieu de 2 attendus).
   *
   * Ce que `not: null` protège réellement, c'est le jour où la comparaison passe côté JS :
   * `null < new Date()` y coerce `null` en 0 et rend TRUE. Toutes les démos permanentes
   * seraient alors sélectionnées et DÉTRUITES. On simule donc une base à sémantique JS,
   * sans garde de nullité : seule la clause `not: null` du code peut encore sauver.
   */
  it('⚠️ DÉCISIF : sous une sémantique de comparaison JS, `not: null` est ce qui sauve les démos permanentes', async () => {
    const tenants: TenantSimule[] = [
      { id: 'demo-tenant-001', demoExpiresAt: null, isDemo: true },
      { id: 'demo-tmp-echue', demoExpiresAt: new Date('2026-10-01T00:00:00Z'), isDemo: true },
    ]
    db.tenant.findMany.mockImplementation(async (args: { where: Record<string, any> }) => {
      const where = args.where
      return tenants.filter(t => {
        if (where.isDemo !== undefined && t.isDemo !== where.isDemo) return false
        const cond = where.demoExpiresAt
        // La clause de nullité est HONORÉE — c'est elle qu'on met à l'épreuve.
        if (cond?.not === null && t.demoExpiresAt === null) return false
        // ⚠️ Comparaison NAÏVE, sans garde : `null < Date` est TRUE en JS.
        if (cond?.lt !== undefined && !((t.demoExpiresAt as unknown as number) < cond.lt)) return false
        return true
      }).map(t => ({ id: t.id }))
    })
    const r = await runDemoPurge(MAINTENANT)
    expect(r.examines, 'seule la démo échue doit être examinée').toBe(1)
    const detruits = purge.hardDeleteTenant.mock.calls.map(c => c[1])
    expect(detruits).not.toContain('demo-tenant-001')
    expect(detruits).toEqual(['demo-tmp-echue'])
  })

  it('⚠️ une seconde passe APRÈS succès ne trouve plus rien — idempotence dans l’autre sens', async () => {
    const restants: TenantSimule[] = [{ id: 'demo-tmp-v', demoExpiresAt: new Date('2026-10-01T00:00:00Z'), isDemo: true }]
    seed(restants)
    // La suppression réussie retire réellement le tenant de la base simulée.
    purge.hardDeleteTenant.mockImplementation(async (_tx: unknown, id: string) => {
      const k = restants.findIndex(t => t.id === id)
      if (k >= 0) restants.splice(k, 1)
      return { Sale: 1 }
    })
    expect((await runDemoPurge(MAINTENANT)).supprimes).toBe(1)
    const p2 = await runDemoPurge(MAINTENANT)
    expect(p2.examines).toBe(0)
    expect(p2.supprimes).toBe(0)
  })
})
