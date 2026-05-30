import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { buildPayrollReport, deliverPayrollReport } from '../services/payrollReport'

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN'])

export async function payrollRoutes(app: any): Promise<void> {
  // POST /api/admin/payroll-report/run — déclenche le récap paie à la demande (test live).
  // Auth obligatoire + RBAC admin (envoie des emails sortants → jamais anonyme).
  // dryRun=true (défaut) : calcule et RENVOIE le récap, AUCUN email, AUCUN marqueur.
  // dryRun=false : envoi réel pour CE tenant (respecte le toggle, sauf `force:true` pour test).
  // Destinataire = admin du tenant, dérivé SERVEUR — aucun champ email accepté du client.
  app.post('/api/admin/payroll-report/run', { preHandler: authenticate }, async (request: any, reply: any) => {
    const role = request.user?.role as string | undefined
    if (!role || !ADMIN_ROLES.has(role)) {
      return reply.code(403).send({ error: 'Accès refusé — admin requis' })
    }

    const body   = (request.body ?? {}) as { dryRun?: boolean; tenantId?: string; force?: boolean }
    const dryRun = body.dryRun !== false             // défaut TRUE
    const force  = body.force === true               // forcer malgré toggle OFF (test)

    // Scope : tenant de l'appelant par défaut. Un tenantId explicite est réservé au SUPER_ADMIN
    // (un ADMIN ne peut JAMAIS cibler un autre tenant → pas d'envoi de masse non voulu).
    const callerTenant = request.tenantId as string
    const targetId = body.tenantId ?? callerTenant
    if (role !== 'SUPER_ADMIN' && targetId !== callerTenant) {
      return reply.code(403).send({ error: 'Tenant non autorisé' })
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: targetId },
      include: { users: { where: { role: 'ADMIN' }, take: 1 } },
    })
    if (!tenant) return reply.code(404).send({ error: 'Tenant introuvable' })

    const report = await buildPayrollReport(prisma, tenant)

    // Respect du toggle (sauf force explicite). Déclenchement manuel : on ne bloque PAS sur
    // le marqueur d'idempotence (pour pouvoir retester), mais on ne le pose QUE sur envoi réel.
    const toggleOn = tenant.notifEmailPayroll
    let emailSent = false
    let reason: string = 'dry_run'
    if (!dryRun) {
      if (!toggleOn && !force) {
        reason = 'toggle_off'
      } else {
        const d = await deliverPayrollReport(prisma, report, { mark: true })
        emailSent = d.sent
        reason = d.reason
      }
    }

    return {
      dryRun,
      tenantId: tenant.id,
      toggle: { notifEmailPayroll: toggleOn, forced: force && !toggleOn },
      recipient: report.recipient,        // dérivé serveur (admin), jamais du client
      report: {
        month:     report.month,
        currency:  report.currency,
        lang:      report.lang,
        headcount: report.headcount,
        payroll:   report.payroll,        // projection
        bonuses:   report.bonuses,        // réel
        total:     report.total,
        hasData:   report.hasData,
      },
      emailSent,
      markerSet: emailSent,               // marqueur posé uniquement si envoi réel
      reason,
    }
  })
}
