import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { eachDateInclusive } from '../lib/dates'
import * as pushService from '../services/pushService'

export const LEAVE_STATUSES = ['PENDING', 'APPROVED', 'REFUSED'] as const
const APPROVER_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'HR'] as const
const canApprove = (role: unknown) => typeof role === 'string' && (APPROVER_ROLES as readonly string[]).includes(role)
const isValidDate = (d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)

interface LeaveBody {
  employeeId?: string; startDate?: string; endDate?: string; leaveType?: string; reason?: string | null
}

function requireApprover(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!canApprove(request.user?.role)) {
    reply.code(403).send({ error: 'Action réservée à ADMIN/MANAGER/RH', code: 'LEAVE_APPROVE_FORBIDDEN' })
    return false
  }
  return true
}

// À l'approbation : génère Shift "Congé" (leave) + Attendance LEAVE pour chaque jour couvert.
// Best-effort (un échec ne doit pas annuler l'approbation déjà persistée).
async function applyApprovedLeaveSideEffects(tenantId: string, employeeId: string, startDate: string, endDate: string): Promise<void> {
  for (const date of eachDateInclusive(startDate, endDate)) {
    try {
      await prisma.shift.upsert({
        where: { tenantId_employeeId_date_shiftTypeKey: { tenantId, employeeId, date, shiftTypeKey: 'leave' } },
        create: { tenantId, employeeId, date, shiftTypeKey: 'leave', startTime: null, endTime: null, label: null, color: null },
        update: { shiftTypeKey: 'leave' },
      })
    } catch (err) { console.warn('[leave-requests] shift upsert failed:', (err as Error)?.message ?? err) }
    try {
      await prisma.attendance.upsert({
        where: { tenantId_employeeId_date: { tenantId, employeeId, date } },
        create: { tenantId, employeeId, date, status: 'LEAVE', arriveTime: null, departTime: null, note: null },
        update: { status: 'LEAVE' },
      })
    } catch (err) { console.warn('[leave-requests] attendance upsert failed:', (err as Error)?.message ?? err) }
  }
}

/**
 * LE MIROIR DE L'APPROBATION — une demande qui cesse d'être approuvée REND le planning.
 *
 * Décision de produit de Nelson (2026-08-14) : supprimer ou refuser un congé approuvé
 * doit libérer le jour. Jusque-là, `applyApprovedLeaveSideEffects` marquait, et RIEN ne
 * démarquait : `DELETE /:id` retirait la demande en laissant le planning afficher un
 * congé sans demande derrière. Mesuré sur `e2e-tenant` — après une purge complète, une
 * seule exécution de la suite E2E ramenait 3 shifts et 3 présences orphelins.
 *
 * ⚠️ UN AUTRE CONGÉ APPROUVÉ PEUT COUVRIR LE MÊME JOUR. C'est le cas qui interdit de
 * supprimer aveuglément : deux demandes sur les mêmes dates existent (c'était exactement
 * le résidu purgé), et retirer l'une ne doit pas démarquer un jour que l'autre justifie
 * toujours. On vérifie donc jour par jour, en s'excluant soi-même.
 *
 * ⚠️ ASYMÉTRIE AVEC L'APPROBATION, ASSUMÉE ET IRRÉDUCTIBLE. Le `shift` est sûr : sa clé
 * composite contient `shiftTypeKey: 'leave'`, donc l'approbation n'a JAMAIS écrasé un
 * autre shift — on ne supprime que ce qu'on a créé. L'`attendance`, elle, a une clé SANS
 * statut : son `upsert` a pu remplacer un `PRESENT` préexistant, et cette valeur est
 * perdue. On ne la restaure donc pas — on retire notre marque, ce qui rend « aucun
 * enregistrement », état neutre. Fabriquer un `PRESENT` serait inventer une présence
 * que personne n'a constatée.
 */
async function revokeApprovedLeaveSideEffects(
  tenantId: string, employeeId: string, startDate: string, endDate: string, sansCeConge: string,
): Promise<void> {
  for (const date of eachDateInclusive(startDate, endDate)) {
    try {
      // ⚠️ Comparaison de CHAÎNES, et c'est volontaire : les colonnes sont des `String`
      // au format `YYYY-MM-DD`, dont l'ordre lexicographique EST l'ordre chronologique.
      const autre = await prisma.leaveRequest.findFirst({
        where: {
          tenantId, employeeId, status: 'APPROVED',
          id: { not: sansCeConge },
          startDate: { lte: date }, endDate: { gte: date },
        },
        select: { id: true },
      })
      if (autre) continue
      // On ne retire QUE ce qui porte encore la marque : un shift retypé ou une présence
      // repassée à `PRESENT` depuis l'approbation n'est plus à nous.
      await prisma.shift.deleteMany({ where: { tenantId, employeeId, date, shiftTypeKey: 'leave' } })
      await prisma.attendance.deleteMany({ where: { tenantId, employeeId, date, status: 'LEAVE' } })
    } catch (err) { console.warn('[leave-requests] revoke failed:', (err as Error)?.message ?? err) }
  }
}

export async function leaveRequestRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/leave-requests?status=PENDING — lecture tout membre, scope tenant.
  app.get('/api/leave-requests', { preHandler: authenticate }, async (request) => {
    const tenantId = request.tenantId
    const { status } = request.query as { status?: string }
    const where: any = { tenantId }
    if (status && (LEAVE_STATUSES as readonly string[]).includes(status)) where.status = status
    return prisma.leaveRequest.findMany({
      where,
      include: { employee: { select: { id: true, name: true, avatar: true, dept: true } } },
      orderBy: [{ createdAt: 'desc' }],
    })
  })

  // POST /api/leave-requests — créer une demande (PENDING). Tout membre pour lui-même ;
  // ADMIN/MANAGER/HR pour n'importe quel employé du tenant.
  app.post('/api/leave-requests', { preHandler: authenticate }, async (request, reply) => {
    const tenantId = request.tenantId!
    const b = request.body as LeaveBody
    if (!b.employeeId || !isValidDate(b.startDate) || !isValidDate(b.endDate)) {
      return reply.code(400).send({ error: 'employeeId, startDate, endDate (YYYY-MM-DD) requis' })
    }
    if (b.endDate < b.startDate) return reply.code(400).send({ error: 'endDate doit être ≥ startDate' })
    const emp = await prisma.employee.findFirst({ where: { id: b.employeeId, tenantId }, select: { id: true, name: true } })
    if (!emp) return reply.code(404).send({ error: 'Employé introuvable dans ce tenant' })
    // Un non-approbateur ne peut soumettre QUE pour lui-même (employeeId == son userId lié).
    if (!canApprove(request.user?.role) && b.employeeId !== request.user?.userId) {
      return reply.code(403).send({ error: 'Vous ne pouvez soumettre une demande que pour vous-même', code: 'LEAVE_SELF_ONLY' })
    }
    const created = await prisma.leaveRequest.create({
      data: {
        tenantId, employeeId: b.employeeId, startDate: b.startDate, endDate: b.endDate,
        leaveType: b.leaveType ?? 'Congé', status: 'PENDING', reason: b.reason ?? null,
      },
    })
    // Push « congé en attente » → ADMIN (fire-and-forget, n'échoue jamais la demande).
    void pushService.sendLeavePending(tenantId, emp.name)
    return created
  })

  // PATCH /api/leave-requests/:id — maj partielle HORS status (dates/type/reason). Approbateur.
  app.patch('/api/leave-requests/:id', { preHandler: authenticate }, async (request, reply) => {
    if (!requireApprover(request, reply)) return
    const tenantId = request.tenantId
    const { id } = request.params as { id: string }
    const b = request.body as LeaveBody
    if (b.startDate !== undefined && !isValidDate(b.startDate)) return reply.code(400).send({ error: 'startDate invalide' })
    if (b.endDate !== undefined && !isValidDate(b.endDate)) return reply.code(400).send({ error: 'endDate invalide' })
    const existing = await prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      select: { id: true, employeeId: true, startDate: true, endDate: true, status: true },
    })
    if (!existing) return reply.code(404).send({ error: 'Demande introuvable' })
    const maj = await prisma.leaveRequest.update({
      where: { id },
      data: {
        ...(b.startDate !== undefined ? { startDate: b.startDate } : {}),
        ...(b.endDate !== undefined ? { endDate: b.endDate } : {}),
        ...(b.leaveType !== undefined ? { leaveType: b.leaveType } : {}),
        ...(b.reason !== undefined ? { reason: b.reason } : {}),
      },
    })
    /**
     * ⚠️ TROISIÈME CHEMIN, le moins visible : DÉPLACER les dates d'un congé approuvé.
     * Les anciens jours restaient marqués et les nouveaux ne l'étaient pas — un congé
     * qui s'affiche là où il n'est plus, et pas là où il est. On révoque l'ANCIENNE
     * plage puis on ré-applique sur la NOUVELLE, dans cet ordre : l'inverse effacerait
     * ce qu'on vient de poser sur les jours communs aux deux plages.
     */
    const datesChangees = (b.startDate !== undefined && b.startDate !== existing.startDate)
                       || (b.endDate !== undefined && b.endDate !== existing.endDate)
    if (existing.status === 'APPROVED' && datesChangees) {
      await revokeApprovedLeaveSideEffects(tenantId!, existing.employeeId, existing.startDate, existing.endDate, id)
      await applyApprovedLeaveSideEffects(tenantId!, existing.employeeId, maj.startDate, maj.endDate)
    }
    return maj
  })

  // POST /api/leave-requests/:id/approve — APPROVED + approvedBy/At + Shifts Congé + Attendance LEAVE.
  app.post('/api/leave-requests/:id/approve', { preHandler: authenticate }, async (request, reply) => {
    if (!requireApprover(request, reply)) return
    const tenantId = request.tenantId!
    const { id } = request.params as { id: string }
    const lr = await prisma.leaveRequest.findFirst({ where: { id, tenantId } })
    if (!lr) return reply.code(404).send({ error: 'Demande introuvable' })
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: request.user?.userId ?? null, approvedAt: new Date() },
    })
    // Effets best-effort APRÈS l'approbation (ne l'annulent pas s'ils échouent).
    await applyApprovedLeaveSideEffects(tenantId, lr.employeeId, lr.startDate, lr.endDate)
    return updated
  })

  /**
   * DELETE /api/leave-requests/:id — supprime une demande.
   *
   * ─── POURQUOI CETTE ROUTE EXISTE ──────────────────────────────────────────
   * Elle manquait, et son absence a produit une fuite MESURÉE le 2026-08-06 : le scénario
   * E2E `leave-planning.spec.ts` crée une vraie demande à chaque exécution et ne pouvait
   * pas la retirer — un commentaire du fichier assumait « l'accumulation » sans jamais la
   * compter. **295 demandes en base pour 2 combinaisons distinctes**, dont 289 sur
   * `e2e-tenant`, accumulées depuis le 2026-07-16 (+26 le 05/08, +11 le 06/08).
   *
   * ⚠️ Ce n'est PAS une route ajoutée pour faire plaisir à un test : son absence était un
   * vrai trou produit. Un gérant qui approuve une demande par erreur, ou un employé qui
   * annule la sienne, n'avaient aucun moyen de la retirer — seulement de la « refuser »,
   * ce qui laisse une ligne refusée dans l'historique et ne dit pas la même chose.
   *
   * Mêmes gardes que `refuse` : approbateur, et scope tenant AVANT l'existence — un tiers
   * obtient 404, jamais 403 (pas d'oracle, § W1).
   */
  app.delete('/api/leave-requests/:id', { preHandler: authenticate }, async (request, reply) => {
    if (!requireApprover(request, reply)) return
    const tenantId = request.tenantId
    const { id } = request.params as { id: string }
    // ⚠️ On relit l'ÉTAT COMPLET, pas seulement l'identifiant : sans les dates, le statut
    // et l'employé, il n'y a plus rien à révoquer une fois la ligne partie.
    const existing = await prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      select: { id: true, employeeId: true, startDate: true, endDate: true, status: true },
    })
    if (!existing) return reply.code(404).send({ error: 'Demande introuvable' })
    await prisma.leaveRequest.delete({ where: { id } })
    // Seul un congé APPROUVÉ a marqué le planning ; en révoquer un autre ne ferait que
    // des requêtes pour rien — et risquerait de démarquer un jour qu'il n'a jamais marqué.
    if (existing.status === 'APPROVED') {
      await revokeApprovedLeaveSideEffects(tenantId!, existing.employeeId, existing.startDate, existing.endDate, id)
    }
    return { ok: true }
  })

  // POST /api/leave-requests/:id/refuse — REFUSED.
  app.post('/api/leave-requests/:id/refuse', { preHandler: authenticate }, async (request, reply) => {
    if (!requireApprover(request, reply)) return
    const tenantId = request.tenantId
    const { id } = request.params as { id: string }
    // ⚠️ LE JUMEAU DE LA SUPPRESSION. Refuser un congé DÉJÀ APPROUVÉ le retire du planning
    // aussi sûrement que le supprimer — ne traiter que `DELETE` aurait déplacé le défaut
    // au lieu de le fermer : l'écran aurait encore montré un congé pour une demande
    // refusée.
    const existing = await prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      select: { id: true, employeeId: true, startDate: true, endDate: true, status: true },
    })
    if (!existing) return reply.code(404).send({ error: 'Demande introuvable' })
    const refusee = await prisma.leaveRequest.update({ where: { id }, data: { status: 'REFUSED' } })
    if (existing.status === 'APPROVED') {
      await revokeApprovedLeaveSideEffects(tenantId!, existing.employeeId, existing.startDate, existing.endDate, id)
    }
    return refusee
  })
}
