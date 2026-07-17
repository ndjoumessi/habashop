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
 * oublie `where:{ tenantId }`. N'ÉCRASE JAMAIS un `tenantId` explicite : en
 * LECTURE il est conservé (cross-tenant volontaire) ; en ÉCRITURE
 * (create/createMany/upsert) un `tenantId` ≠ contexte fait ÉCHOUER la requête
 * (`TenantScopeMismatchError` → 403). Le filtrage manuel existant est conservé
 * (ceinture-bretelles).
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
// non-unique dans un where unique ; le `where` d'upsert idem — clé composite
// ex. TicketZ — mais son PAYLOAD create/update est gardé, cf. ci-dessous.)
const INJECT_OPS = /^(findMany|findFirst|updateMany|deleteMany|count|aggregate|groupBy)$/

/**
 * Écriture avec `tenantId` explicite ≠ boutique active du contexte : on REFUSE
 * (jamais d'écrasement silencieux — un mismatch = bug ou tentative d'injection).
 * `statusCode` 403 → l'error handler global renvoie un 403 propre.
 */
export class TenantScopeMismatchError extends Error {
  statusCode = 403
  constructor(model: string, operation: string) {
    super(`Écriture ${model}.${operation} refusée : tenantId du payload ≠ boutique active`)
    this.name = 'TenantScopeMismatchError'
  }
}

// Garde d'écriture commune (create/createMany/upsert) : injecte `tenantId` si
// absent, THROW s'il est présent et différent du tenant du contexte.
function guardWriteRows(model: string, operation: string, data: any, tenantId: string): boolean {
  if (!data) return false
  const rows = Array.isArray(data) ? data : [data]
  let injected = false
  for (const row of rows) {
    if (row.tenantId === undefined) { row.tenantId = tenantId; injected = true }
    else if (row.tenantId !== tenantId) throw new TenantScopeMismatchError(model, operation)
  }
  return injected
}

/**
 * Cœur de l'auto-scoping (pur, testable). Mute `args` EN PLACE selon les règles :
 * - modèle non scopé ou op hors périmètre → aucun changement ;
 * - lecture/màj-many/agrégat sans `where.tenantId` → injecte `where.tenantId`
 *   (un `where.tenantId` explicite est CONSERVÉ : cross-tenant volontaire en
 *   lecture, ex. push vers la boutique partenaire d'un transfert) ;
 * - ÉCRITURES `create`/`createMany`/`upsert` : `tenantId` absent → injecté ;
 *   présent et ≠ contexte → `TenantScopeMismatchError` (403), jamais écrasé
 *   en silence. Pour `upsert` : payloads `create` ET `update` gardés (le
 *   `where` composite reste hors périmètre).
 * Retourne `true` si une injection a eu lieu (pour l'observabilité/les tests).
 */
export function applyTenantScope(model: string | undefined, operation: string, args: any, tenantId: string): boolean {
  if (!model || !SCOPED_MODELS.has(model) || !args) return false
  if (INJECT_OPS.test(operation)) {
    if (args.where?.tenantId === undefined) { args.where = { ...(args.where ?? {}), tenantId }; return true }
    return false
  }
  if (operation === 'create' || operation === 'createMany') {
    return guardWriteRows(model, operation, args.data, tenantId)
  }
  if (operation === 'upsert') {
    const injected = guardWriteRows(model, operation, args.create, tenantId)
    if (args.update?.tenantId !== undefined && args.update.tenantId !== tenantId) {
      throw new TenantScopeMismatchError(model, operation)
    }
    return injected
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
