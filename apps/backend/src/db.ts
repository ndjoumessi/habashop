import { PrismaClient } from '@prisma/client'
import { tenantCtx } from './lib/tenantContext'

/**
 * Client Prisma partagé (singleton) pour tout le backend.
 *
 * `basePrisma` — client NON étendu : à utiliser pour les accès cross-tenant
 * LÉGITIMES à l'intérieur d'une requête authentifiée (ex. dashboard consolidé
 * qui agrège plusieurs boutiques de l'utilisateur). Les crons, webhooks et
 * routes super-admin n'entrent pas dans le contexte tenant → ils peuvent
 * utiliser `prisma` sans risque de scoping involontaire.
 *
 * `prisma` — client ÉTENDU (defense-in-depth, item 8) : injecte automatiquement
 * `tenantId` sur les modèles tenant-scopés QUAND il est absent, à partir du
 * contexte `tenantCtx` posé par `authenticate`. Filet de sécurité si un handler
 * oublie `where:{ tenantId }`. N'ÉCRASE JAMAIS un `tenantId` explicite (les
 * requêtes cross-tenant volontaires — dashboard consolidé — restent correctes).
 * Le filtrage manuel existant est conservé (ceinture-bretelles).
 */
export const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

// Modèles portant un `tenantId` scalaire ET scopables automatiquement.
// Exclus volontairement : User (lookup email global), UserTenant (autorité des
// droits), PlanRequest (réconciliation webhook / super-admin), Tenant,
// StockTransfer (isolation par 2 FK), SaleItem/PurchaseOrderItem/SubscriptionItem
// (pas de tenantId, scopés via le parent).
const SCOPED_MODELS = new Set([
  'Product', 'Sale', 'Customer', 'Supplier', 'PurchaseOrder', 'Employee',
  'Attendance', 'Shift', 'LeaveRequest', 'Expense', 'Goal', 'Subscription',
  'Campaign', 'TicketZ', 'LoyaltyTransaction', 'EmployeeBonus', 'SalaryHistory',
  'PushToken', 'AuditLog',
])

// Opérations dont le `where` accepte un filtre non-unique → injection sûre.
// (findUnique/update/delete par clé unique EXCLUS : Prisma refuse un tenantId
// non-unique dans un where unique ; upsert exclu — clé composite ex. TicketZ.)
const INJECT_OPS = /^(findMany|findFirst|updateMany|deleteMany|count|aggregate|groupBy)$/

/**
 * Cœur de l'auto-scoping (pur, testable). Mute `args` EN PLACE selon les règles :
 * - modèle non scopé, op hors périmètre, ou tenantId déjà présent → aucun changement ;
 * - lecture/màj-many/agrégat sans `where.tenantId` → injecte `where.tenantId` ;
 * - `create` sans `data.tenantId` → pose `data.tenantId`.
 * Retourne `true` si une injection a eu lieu (pour l'observabilité/les tests).
 */
export function applyTenantScope(model: string | undefined, operation: string, args: any, tenantId: string): boolean {
  if (!model || !SCOPED_MODELS.has(model) || !args) return false
  if (INJECT_OPS.test(operation)) {
    if (args.where?.tenantId === undefined) { args.where = { ...(args.where ?? {}), tenantId }; return true }
  } else if (operation === 'create') {
    if (args.data && args.data.tenantId === undefined) { args.data.tenantId = tenantId; return true }
  }
  return false
}

export const prisma = basePrisma.$extends({
  name: 'tenant-scope',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const ctx = tenantCtx.getStore()
        if (ctx?.tenantId) applyTenantScope(model, operation, args as any, ctx.tenantId)
        return query(args)
      },
    },
  },
})

// Type du client interactif de transaction du client ÉTENDU (pour typer les
// helpers qui reçoivent le `tx` de `prisma.$transaction`).
export type TxClient = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>
