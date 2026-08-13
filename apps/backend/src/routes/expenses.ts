import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { getTenantId } from '../lib/tenantId'
import { ID_PARAMS, EXPENSE_CREATE, EXPENSE_UPDATE } from '../schemas/writesB'
import { invalidateTenantCache } from '../lib/cache'
import { writeAudit } from '../lib/writeAudit'
import { diffAudite, descriptionAudit } from '../lib/auditDiff'

/**
 * ⚠️ `notes` est DEHORS : c'est le champ de texte long, celui où l'on écrit une
 * circonstance. `label` y est, parce que sans lui l'entrée ne désigne aucune
 * dépense — « amountTTC 50 000 → 60 000 » ne dit pas laquelle, et deux loyers du
 * même mois sont indiscernables. Le budget d'écriture d'un journal plafonné à 100
 * lignes se dépense sur ce qui permet de retrouver la ligne.
 */
const CHAMPS_AUDITES_DEPENSE = [
  'date', 'label', 'category', 'amountHT', 'vat', 'amountTTC', 'mode', 'recurrent', 'status',
] as const

export async function expenseRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/expenses', { preHandler: authenticate }, async (request) => {
    const tenantId = getTenantId(request)
    return prisma.expense.findMany({ where: { tenantId }, orderBy: { date: 'desc' } })
  })

  app.post('/api/expenses', { preHandler: authenticate, schema: { body: EXPENSE_CREATE } }, async (request) => {
    const tenantId = getTenantId(request)
    const expense = await prisma.expense.create({ data: { ...(request.body as any), tenantId } })
    invalidateTenantCache(tenantId).catch(() => {})
    await writeAudit('CREATE_EXPENSE', prisma.auditLog.create({
      data: {
        tenantId, userId: request.user.userId, module: 'expenses', action: 'CREATE_EXPENSE',
        // Le montant fait partie de l'identité de la dépense autant que son libellé :
        // « Loyer août » sans somme n'apprend rien à qui relit le journal.
        description: descriptionAudit(expense.label, { amountTTC: { avant: null, apres: expense.amountTTC } }),
      },
    }))
    return expense
  })

  app.put('/api/expenses/:id', { preHandler: authenticate, schema: { params: ID_PARAMS, body: EXPENSE_UPDATE } }, async (request) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    // ⚠️ LU AVANT L'ÉCRITURE, et scopé au tenant comme la mise à jour elle-même : un
    // `findUnique` par identifiant seul rendrait la ligne d'une AUTRE boutique, donc
    // un diff qui compare deux tenants. `update` refuserait ensuite, mais le journal
    // aurait déjà lu ce qu'il ne devait pas voir.
    const avant = await prisma.expense.findFirst({ where: { id, tenantId } })
    const expense = await prisma.expense.update({ where: { id, tenantId }, data: request.body as any })
    invalidateTenantCache(tenantId).catch(() => {})
    const diff = diffAudite(avant as Record<string, unknown> | null, expense as unknown as Record<string, unknown>, CHAMPS_AUDITES_DEPENSE)
    if (diff) {
      await writeAudit('UPDATE_EXPENSE', prisma.auditLog.create({
        data: {
          tenantId, userId: request.user.userId, module: 'expenses', action: 'UPDATE_EXPENSE',
          description: descriptionAudit(expense.label, diff),
        },
      }))
    }
    return expense
  })

  app.delete('/api/expenses/:id', { preHandler: authenticate, schema: { params: ID_PARAMS } }, async (request) => {
    const tenantId = getTenantId(request)
    const { id } = request.params as { id: string }
    // ⚠️ RELU AVANT LA SUPPRESSION — après, il n'y a plus rien à consigner. Une
    // suppression est le seul cas où l'audit est la SEULE trace restante : la ligne
    // n'existe plus nulle part ailleurs (pas de `deletedAt` sur `Expense`).
    const avant = await prisma.expense.findFirst({ where: { id, tenantId }, select: { label: true, amountTTC: true } })
    await prisma.expense.delete({ where: { id, tenantId } })
    invalidateTenantCache(tenantId).catch(() => {})
    if (avant) {
      await writeAudit('DELETE_EXPENSE', prisma.auditLog.create({
        data: {
          tenantId, userId: request.user.userId, module: 'expenses', action: 'DELETE_EXPENSE',
          description: descriptionAudit(avant.label, { amountTTC: { avant: avant.amountTTC, apres: null } }),
        },
      }))
    }
    return { success: true }
  })
}
