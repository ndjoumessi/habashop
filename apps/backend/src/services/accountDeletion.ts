import { randomUUID } from 'crypto'
import { prisma, type TxClient } from '../db'
import { invalidateUserStatus } from '../lib/userStatus'

/**
 * Suppression de compte in-app (Google Play / RGPD). Soft delete + anonymisation PII.
 * Données transactionnelles (Sale, SalaryHistory, Expense, PurchaseOrder, AuditLog…)
 * conservées (obligations comptables) ; les noms anonymisés suivent via les FK.
 *
 * Point d'entrée UNIQUE : `deleteAccount(userId)` décide seul user vs tenant.
 * Règle (option A + garde-fou) :
 *  - SUPER_ADMIN                       → suppression du tenant
 *  - ADMIN sans autre ADMIN actif      → suppression du tenant (propriétaire de fait)
 *  - ADMIN avec ≥1 autre ADMIN actif   → suppression user (il "quitte" le tenant)
 *  - autre rôle                        → suppression user
 */

export type AccountDeletionCode = 'USER_NOT_FOUND' | 'ALREADY_DELETED'
export class AccountDeletionError extends Error {
  constructor(public readonly code: AccountDeletionCode) {
    super(code)
    this.name = 'AccountDeletionError'
  }
}

export type DeletionScope = 'user' | 'tenant'

const ANON = {
  user: 'Compte supprimé',
  customer: 'Client anonyme',
  employee: 'Employé anonyme',
  supplier: 'Fournisseur anonyme',
  tenant: 'Boutique supprimée',
} as const

const deletedEmail = () => `deleted-${randomUUID()}@deleted.local`

/** Anonymise un User + purge ses PII annexes (IP des logs, push tokens). */
async function anonymizeUser(tx: TxClient, userId: string, now: Date): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: {
      name: ANON.user,
      email: deletedEmail(),     // email @unique → uuid garantit l'unicité ; l'original redevient libre
      passwordHash: '',          // colonne NOT NULL → '' neutralise le credential (bcrypt.compare échoue)
      twoFASecret: null,
      twoFAEnabled: false,
      isActive: false,
      deletedAt: now,
    },
  })
  await tx.auditLog.updateMany({ where: { userId }, data: { ip: null } })   // note 8 : purge IP, reste conservé
  await tx.pushToken.deleteMany({ where: { userId } })                       // note 7 : hard delete tokens device
}

/** Décide la portée selon la règle finale (option A + garde-fou). */
async function decideScope(tx: TxClient, user: { id: string; tenantId: string; role: string }): Promise<DeletionScope> {
  if (user.role === 'SUPER_ADMIN') return 'tenant'
  if (user.role === 'ADMIN') {
    const otherActiveAdmins = await tx.user.count({
      where: { tenantId: user.tenantId, role: 'ADMIN', deletedAt: null, id: { not: user.id } },
    })
    return otherActiveAdmins === 0 ? 'tenant' : 'user'
  }
  return 'user'
}

/**
 * Supprime le compte de `userId`. Décide seul user-scope vs tenant-scope.
 * @returns `{ scope }` pour que le mobile affiche le bon message.
 * @throws AccountDeletionError 'USER_NOT_FOUND' | 'ALREADY_DELETED'
 */
export async function deleteAccount(userId: string): Promise<{ scope: DeletionScope }> {
  const { scope, affectedUserIds } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user) throw new AccountDeletionError('USER_NOT_FOUND')
    if (user.deletedAt) throw new AccountDeletionError('ALREADY_DELETED')

    const decided = await decideScope(tx, user)
    const now = new Date()

    if (decided === 'user') {
      await anonymizeUser(tx, user.id, now)
      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId, userId: user.id,
          module: 'account_deletion', action: 'DELETE_USER',
          description: `Compte utilisateur anonymisé (self-service) — ${now.toISOString()}`,
          severity: 'critical',
        },
      })
      return { scope: decided, affectedUserIds: [user.id] }
    }

    // tenant-scope : anonymisation en cascade dans la même transaction
    const users = await tx.user.findMany({ where: { tenantId: user.tenantId, deletedAt: null }, select: { id: true } })
    for (const u of users) await anonymizeUser(tx, u.id, now)

    await tx.customer.updateMany({
      where: { tenantId: user.tenantId, deletedAt: null },
      data: { name: ANON.customer, phone: null, email: null, address: null, deletedAt: now },
    })
    await tx.employee.updateMany({
      where: { tenantId: user.tenantId, deletedAt: null },
      data: { name: ANON.employee, phone: null, email: null, address: null, photo: null, avatar: '?', isActive: false, deletedAt: now },
    })
    await tx.supplier.updateMany({
      where: { tenantId: user.tenantId, deletedAt: null },
      data: { name: ANON.supplier, phone: null, email: null, address: null, notes: null, deletedAt: now },
    })
    await tx.tenant.update({
      where: { id: user.tenantId },
      data: {
        name: ANON.tenant, phone: null, email: null, address: null, logo: null,
        notes: null, paymentRef: null, suspendReason: null,
        isActive: false, status: 'cancelled', deletedAt: now,
      },
    })
    await tx.pushToken.deleteMany({ where: { tenantId: user.tenantId } })

    await tx.auditLog.create({
      data: {
        tenantId: user.tenantId, userId: user.id,
        module: 'account_deletion', action: 'DELETE_TENANT',
        description: `Boutique + ${users.length} compte(s)/clients/employés/fournisseurs anonymisés — ${now.toISOString()}`,
        severity: 'critical',
      },
    })
    return { scope: decided, affectedUserIds: users.map((u) => u.id) }
  })

  // Après commit : invalider le cache de statut (durcissement point 4) → rejet immédiat.
  await invalidateUserStatus(affectedUserIds)
  return { scope }
}
