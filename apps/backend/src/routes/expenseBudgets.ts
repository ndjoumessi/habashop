import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { writeAudit } from '../lib/writeAudit'
import { authenticate } from '../middleware/authenticate'
import { getActiveTenantId } from '../lib/tenantId'
import { EXPENSE_CATEGORIES, isExpenseCategory } from '../lib/expenseCategories'
import { EXPENSE_BUDGETS_PUT } from '../schemas/writesB'

/**
 * BUDGETS DE DÉPENSE — persistés par boutique.
 *
 * ⚠️ `getActiveTenantId`, PAS `getTenantId`. Les budgets appartiennent à la boutique
 * ACTIVE (celle que le commerçant regarde), pas à la boutique d'origine du JWT : un
 * gérant multi-boutiques aurait sinon écrit les budgets de Dakar depuis l'écran
 * d'Abidjan. Appelé APRÈS `authenticate`, qui résout la boutique active.
 */

/** Dictionnaire complet catégorie → montant, toutes les catégories présentes. */
type BudgetMap = Record<string, number>

/**
 * ⚠️ TOUTES les catégories sont rendues, même sans ligne en base — à ZÉRO.
 * Un dictionnaire partiel obligerait chaque appelant à inventer un défaut, et ils en
 * inventeraient des différents : c'est précisément d'où venaient les littéraux du front.
 * Zéro est un fait ici : « aucun budget posé pour cette catégorie ».
 */
function toMap(lignes: { category: string; amount: number }[]): BudgetMap {
  const base: BudgetMap = {}
  for (const c of EXPENSE_CATEGORIES) base[c] = 0
  for (const l of lignes) if (isExpenseCategory(l.category)) base[l.category] = l.amount
  return base
}

export async function expenseBudgetRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/expense-budgets', { preHandler: authenticate }, async (request) => {
    const tenantId = getActiveTenantId(request)
    const lignes = await prisma.expenseBudget.findMany({
      where: { tenantId },
      select: { category: true, amount: true },
    })
    return { budgets: toMap(lignes) }
  })

  app.put(
    '/api/expense-budgets',
    { preHandler: authenticate, schema: { body: EXPENSE_BUDGETS_PUT } },
    async (request, reply) => {
      const tenantId = getActiveTenantId(request)
      const { budgets } = request.body as { budgets: BudgetMap }

      /**
       * ⚠️ REFUS EXPLICITE d'une catégorie inconnue, jamais un filtrage silencieux.
       * Ignorer la clé ferait répondre 200 sur une écriture qui n'a pas eu lieu :
       * l'appelant croirait avoir enregistré un budget qui n'existe pas — le défaut
       * même qu'on vient de fermer côté écran.
       */
      const inconnues = Object.keys(budgets).filter(k => !isExpenseCategory(k))
      if (inconnues.length > 0) {
        return reply.code(400).send({
          error: `Catégorie inconnue : ${inconnues.join(', ')}`,
          code: 'UNKNOWN_EXPENSE_CATEGORY',
        })
      }

      const avant = toMap(await prisma.expenseBudget.findMany({
        where: { tenantId }, select: { category: true, amount: true },
      }))

      // ⚠️ `upsert` sur la clé composite `(tenantId, category)` : l'écriture est
      // IDEMPOTENTE. Un `deleteMany` + `createMany` laisserait une fenêtre où la
      // boutique n'a plus aucun budget si la seconde requête échoue.
      await prisma.$transaction(
        Object.entries(budgets).map(([category, amount]) =>
          prisma.expenseBudget.upsert({
            where: { tenantId_category: { tenantId, category } },
            create: { tenantId, category, amount },
            update: { amount },
          }),
        ),
      )

      const apres = toMap(await prisma.expenseBudget.findMany({
        where: { tenantId }, select: { category: true, amount: true },
      }))

      /**
       * ⚠️ AVANT → APRÈS des seules catégories QUI ONT BOUGÉ, comme
       * `TENANT_LOCALE_CHANGE`. « Les budgets ont changé » ne permettrait de rien
       * reconstituer ; consigner les huit à chaque fois noierait le changement réel.
       * Uniquement des noms de catégorie et des nombres — aucune donnée personnelle.
       */
      const change = EXPENSE_CATEGORIES
        .filter(c => avant[c] !== apres[c])
        .map(c => [c, { avant: avant[c], apres: apres[c] }] as const)

      if (change.length) {
        await writeAudit('EXPENSE_BUDGET_CHANGE', prisma.auditLog.create({
          data: {
            tenantId,
            userId: request.user!.userId,
            module: 'SETTINGS',
            action: 'EXPENSE_BUDGET_CHANGE',
            description: JSON.stringify(Object.fromEntries(change)),
            severity: 'info',
          },
        }))
      }

      return { budgets: apres }
    },
  )
}
