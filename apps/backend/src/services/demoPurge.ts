import { prisma } from '../db'
import { hardDeleteTenant, type PurgeTx } from '../lib/tenantPurge'
import * as Sentry from '@sentry/node'

/**
 * PURGE DES DÉMOS JETABLES — passe quotidienne.
 *
 * ⚠️ La sélection exige `demoExpiresAt` NON NUL et DÉPASSÉ. Les démos permanentes
 * (`demo-tenant-001/002`) et `e2e-tenant` portent `null` : elles sont impurgeables PAR
 * CONSTRUCTION. Ne jamais remplacer cette condition par un test sur le nom ou le préfixe —
 * une liste de noms vieillit, une propriété non.
 *
 * ⚠️ IDEMPOTENTE par nature : la condition porte sur l'échéance, donc une seconde passe ne
 * trouve plus rien et une passe interrompue est reprise par la suivante. Pas de marqueur en
 * base — il ne protégerait de rien. C'est aussi ce qui rend sans danger un cron dont deux
 * ticks peuvent tomber dans la même fenêtre de garde.
 *
 * ⚠️ Un ménage s'ASSERTE sur le COMPTE, il n'est jamais « best-effort » : la passe rend
 * examinés / supprimés / échecs, et les échecs partent en Sentry (un `console.error` seul
 * est un signal que personne ne reçoit).
 */
export async function runDemoPurge(now = new Date()): Promise<{ examines: number; supprimes: number; echecs: number }> {
  const expirees = await prisma.tenant.findMany({
    where: {
      isDemo: true,
      // ⚠️ Les DEUX conditions sont nécessaires : `not: null` protège les démos
      // permanentes, `lt` borne aux échues.
      demoExpiresAt: { not: null, lt: now },
    },
    select: { id: true },
  })

  let supprimes = 0
  let echecs = 0
  for (const t of expirees) {
    try {
      await prisma.$transaction(
        async (tx) => { await hardDeleteTenant(tx as unknown as PurgeTx, t.id) },
        { timeout: 60_000 },
      )
      supprimes++
    } catch (e) {
      echecs++
      // ⚠️ On continue : un échec sur une démo ne doit pas bloquer les autres.
      console.error(`[demo-purge] échec sur ${t.id}:`, e)
      Sentry.captureException(e, { extra: { tenantId: t.id, etape: 'demo-purge' } })
    }
  }

  const resume = `[demo-purge] ${expirees.length} examinée(s), ${supprimes} supprimée(s), ${echecs} échec(s)`
  if (echecs > 0) console.warn(resume)
  else console.log(resume)

  return { examines: expirees.length, supprimes, echecs }
}
