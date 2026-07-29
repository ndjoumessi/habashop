import { z } from 'zod'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { writeAudit } from '../lib/writeAudit'
import { getActiveTenantId } from '../lib/tenantId'
import { buildPayrollReport, deliverPayrollReport } from '../services/payrollReport'
import { payrollBreakdown, MONTH_KEY } from '../utils/payroll'

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN'])

// Rôles autorisés sur les bulletins de paie.
// ⚠️ MIROIR EXACT de `ROLE_PERMISSIONS['payroll']` côté front (`stores/authStore.ts`).
// Un serveur PLUS STRICT que l'UI ne protège rien : il produit des boutons visibles qui
// renvoient 403 — l'utilisateur conclut que l'app est cassée, pas qu'il n'a pas le droit.
// Si la liste change d'un côté, elle doit changer de l'autre (CASHIER reste exclu).
const PAYROLL_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'ACCOUNTANT', 'HR'])

const PAY_STATUSES = ['EN ATTENTE', 'GÉNÉRÉ', 'PAYÉ', 'SUSPENDU'] as const

// ⚠️ `month` = "YYYY-MM" STRICT. Le front manipule un libellé français (« Juillet 2026 ») ;
// il ne doit jamais atteindre la base — une clé qui dépend de la langue d'affichage rend les
// données illisibles au changement de locale. Le refus est ici, pas dans le handler.
const MONTH_QUERY  = z.object({ month: z.string().regex(MONTH_KEY, 'month attendu au format YYYY-MM') })
const GENERATE_BODY = z.object({ month: z.string().regex(MONTH_KEY, 'month attendu au format YYYY-MM') })
const STATUS_BODY  = z.object({ status: z.enum(PAY_STATUSES) })
const ID_PARAMS    = z.object({ id: z.string().min(1) })

export async function payrollRoutes(app: any): Promise<void> {
  // POST /api/admin/payroll-report/run — déclenche le récap paie à la demande (test live).
  // Auth obligatoire + RBAC admin (envoie des emails sortants → jamais anonyme).
  // dryRun=true (défaut) : calcule et RENVOIE le récap, AUCUN email, AUCUN marqueur.
  // dryRun=false : envoi réel pour CE tenant (respecte le toggle, sauf `force:true` pour test).
  // Destinataire = admin du tenant, dérivé SERVEUR — aucun champ email accepté du client.
  app.post('/api/admin/payroll-report/run', {
    preHandler: authenticate,
    schema: {
      body: z.object({
        dryRun:   z.boolean().optional(),
        tenantId: z.string().trim().min(1).optional(),
        force:    z.boolean().optional(),
      }),
    },
  }, async (request: any, reply: any) => {
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

  // ── Bulletins de paie PERSISTÉS ────────────────────────────────────────────
  // Avant : les statuts vivaient dans un `useState` de `Payroll.tsx` et disparaissaient au
  // rafraîchissement. Un gérant marquait des salaires « PAYÉ », rechargeait, tout revenait à
  // « EN ATTENTE » — on ne savait plus qui avait été payé.

  // GET /api/payroll?month=YYYY-MM — bulletins du mois pour la boutique ACTIVE.
  app.get('/api/payroll', {
    preHandler: authenticate,
    schema: { querystring: MONTH_QUERY },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { userId?: string; role?: string } | undefined
    const role = user?.role
    if (!role || !PAYROLL_ROLES.has(role)) return reply.code(403).send({ error: 'Accès refusé' })

    const tenantId = getActiveTenantId(request)
    const { month } = request.query as { month: string }
    return prisma.payroll.findMany({
      where: { tenantId, month },
      orderBy: { employeeName: 'asc' },
    })
  })

  // POST /api/payroll/generate — fige un bulletin par employé ACTIF sans bulletin ce mois-là.
  //
  // ⚠️ INSTANTANÉ GELÉ : les montants sont COPIÉS depuis `Employee` au moment de la
  // génération, jamais joints à l'affichage. Une augmentation en août ne doit pas réécrire ce
  // qui a été versé en juin (c'est l'inverse de la règle Abonnements, « au tarif du jour »).
  //
  // ⚠️ IDEMPOTENT : `@@unique([tenantId, employeeId, month])` + `skipDuplicates`. Rejouer
  // « Générer » ne duplique pas et ne réécrit PAS les bulletins existants — sinon un second
  // clic écraserait un bulletin déjà payé avec le salaire du jour.
  app.post('/api/payroll/generate', {
    preHandler: authenticate,
    schema: { body: GENERATE_BODY },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { userId?: string; role?: string } | undefined
    const role = user?.role
    if (!role || !PAYROLL_ROLES.has(role)) return reply.code(403).send({ error: 'Accès refusé' })

    const tenantId = getActiveTenantId(request)
    const userId   = user?.userId as string
    const { month } = request.body as { month: string }

    const [employees, existing] = await Promise.all([
      prisma.employee.findMany({
        where: { tenantId, isActive: true, deletedAt: null },
        select: { id: true, name: true, role: true, salary: true },
      }),
      prisma.payroll.findMany({ where: { tenantId, month }, select: { employeeId: true } }),
    ])

    const dejaFait = new Set(existing.map(p => p.employeeId))
    const aCreer = employees.filter(e => !dejaFait.has(e.id)).map(e => {
      const entree = { baseSalary: e.salary ?? 0, bonus: 0, overtime: 0, deductions: 0, absences: 0 }
      // ⚠️ Les COTISATIONS sont figées comme le reste : elles dépendent de taux légaux, donc les
      // recalculer à l'affichage rejouerait un bulletin passé au barème du jour.
      const bd = payrollBreakdown(entree)
      return {
        tenantId,
        employeeId:   e.id,
        month,
        status:       'GÉNÉRÉ',
        employeeName: e.name,        // figé AUSSI : un employé renommé ne réécrit pas sa paie passée
        role:         e.role ?? '',
        ...entree,
        cnss: bd.cnss,
        ir:   bd.ir,
        net:  bd.net,
      }
    })

    if (aCreer.length > 0) {
      await prisma.payroll.createMany({ data: aCreer, skipDuplicates: true })
      await writeAudit('GENERATE_PAYROLL', prisma.auditLog.create({
        data: {
          tenantId, userId, module: 'payroll', action: 'GENERATE_PAYROLL',
          description: JSON.stringify({ month, count: aCreer.length }),
        },
      }))
    }

    const rows = await prisma.payroll.findMany({
      where: { tenantId, month },
      orderBy: { employeeName: 'asc' },
    })
    return { created: aCreer.length, rows }
  })

  // PATCH /api/payroll/:id — change le statut d'un bulletin (« PAYÉ » en pratique).
  // ⚠️ Scope tenant AVANT existence : un bulletin d'un autre tenant rend 404, jamais 403 —
  // un 403 confirmerait que l'identifiant existe (oracle, cf. W1 du § Sécurité).
  app.patch('/api/payroll/:id', {
    preHandler: authenticate,
    schema: { params: ID_PARAMS, body: STATUS_BODY },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { userId?: string; role?: string } | undefined
    const role = user?.role
    if (!role || !PAYROLL_ROLES.has(role)) return reply.code(403).send({ error: 'Accès refusé' })

    const tenantId = getActiveTenantId(request)
    const userId   = user?.userId as string
    const { id }     = request.params as { id: string }
    const { status } = request.body as { status: typeof PAY_STATUSES[number] }

    const bulletin = await prisma.payroll.findFirst({ where: { id, tenantId } })
    if (!bulletin) return reply.code(404).send({ error: 'Bulletin introuvable' })

    // `paidAt` est posé par le SERVEUR, jamais reçu du client : c'est une date de paiement,
    // elle doit être vérifiable. Repasser hors « PAYÉ » l'efface (sinon un bulletin remis en
    // attente garderait une date de versement qui n'a pas eu lieu).
    const updated = await prisma.payroll.update({
      where: { id },
      data: { status, paidAt: status === 'PAYÉ' ? new Date() : null },
    })

    await writeAudit('UPDATE_PAYROLL_STATUS', prisma.auditLog.create({
      data: {
        tenantId, userId, module: 'payroll', action: 'UPDATE_PAYROLL_STATUS',
        description: JSON.stringify({ id, month: bulletin.month, from: bulletin.status, to: status }),
      },
    }))

    return updated
  })
}
