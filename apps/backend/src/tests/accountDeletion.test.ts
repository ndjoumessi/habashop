import { describe, it, expect, vi, beforeEach } from 'vitest'

// tx mock contrôlable (hoisté pour être visible dans la factory de vi.mock)
const { tx } = vi.hoisted(() => ({
  tx: {
    user: { findUnique: vi.fn(), count: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    customer: { updateMany: vi.fn() },
    employee: { updateMany: vi.fn() },
    supplier: { updateMany: vi.fn() },
    tenant: { update: vi.fn() },
    pushToken: { deleteMany: vi.fn() },
    auditLog: { updateMany: vi.fn(), create: vi.fn() },
  },
}))

// $transaction(fn) exécute simplement fn(tx) ; redis null → invalidateUserStatus no-op
vi.mock('../db', () => ({ prisma: { $transaction: (fn: any) => fn(tx) } }))
vi.mock('../redis', () => ({ redis: null }))

import { deleteAccount } from '../services/accountDeletion'

beforeEach(() => {
  vi.clearAllMocks()
  tx.user.update.mockResolvedValue({})
  tx.customer.updateMany.mockResolvedValue({ count: 0 })
  tx.employee.updateMany.mockResolvedValue({ count: 0 })
  tx.supplier.updateMany.mockResolvedValue({ count: 0 })
  tx.tenant.update.mockResolvedValue({})
  tx.pushToken.deleteMany.mockResolvedValue({ count: 0 })
  tx.auditLog.updateMany.mockResolvedValue({ count: 0 })
  tx.auditLog.create.mockResolvedValue({})
  tx.user.findMany.mockResolvedValue([])
  tx.user.count.mockResolvedValue(0)
})

describe('deleteAccount — décision de portée + anonymisation', () => {
  it('user secondaire (CASHIER) → scope user, tenant intact', async () => {
    tx.user.findUnique.mockResolvedValue({ id: 'u1', tenantId: 't1', role: 'CASHIER', deletedAt: null })

    const r = await deleteAccount('u1')

    expect(r).toEqual({ scope: 'user' })
    const data = tx.user.update.mock.calls[0][0].data
    expect(data).toMatchObject({ name: 'Compte supprimé', passwordHash: '', twoFASecret: null, twoFAEnabled: false, isActive: false })
    expect(data.email).toMatch(/^deleted-.+@deleted\.local$/)
    expect(data.deletedAt).toBeInstanceOf(Date)
    expect(tx.tenant.update).not.toHaveBeenCalled()
    expect(tx.pushToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    expect(tx.auditLog.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1' }, data: { ip: null } })
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ module: 'account_deletion', action: 'DELETE_USER' }) }))
  })

  it('SUPER_ADMIN → scope tenant, cascade complète', async () => {
    tx.user.findUnique.mockResolvedValue({ id: 'a1', tenantId: 't1', role: 'SUPER_ADMIN', deletedAt: null })
    tx.user.findMany.mockResolvedValue([{ id: 'a1' }, { id: 'u2' }])

    const r = await deleteAccount('a1')

    expect(r).toEqual({ scope: 'tenant' })
    expect(tx.user.count).not.toHaveBeenCalled() // SUPER_ADMIN décide directement
    expect(tx.user.update).toHaveBeenCalledTimes(2) // tous les users anonymisés
    expect(tx.customer.updateMany.mock.calls[0][0].data).toMatchObject({ name: 'Client anonyme', phone: null })
    expect(tx.employee.updateMany.mock.calls[0][0].data).toMatchObject({ name: 'Employé anonyme', photo: null, avatar: '?' })
    expect(tx.supplier.updateMany.mock.calls[0][0].data).toMatchObject({ name: 'Fournisseur anonyme', notes: null })
    expect(tx.tenant.update.mock.calls[0][0].data).toMatchObject({ name: 'Boutique supprimée', status: 'cancelled', isActive: false })
    expect(tx.tenant.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date)
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'DELETE_TENANT' }) }))
  })

  it('ADMIN seul (0 autre admin actif) → scope tenant', async () => {
    tx.user.findUnique.mockResolvedValue({ id: 'a1', tenantId: 't1', role: 'ADMIN', deletedAt: null })
    tx.user.count.mockResolvedValue(0)
    tx.user.findMany.mockResolvedValue([{ id: 'a1' }])

    const r = await deleteAccount('a1')

    expect(r).toEqual({ scope: 'tenant' })
    expect(tx.user.count).toHaveBeenCalledWith({ where: { tenantId: 't1', role: 'ADMIN', deletedAt: null, id: { not: 'a1' } } })
    expect(tx.tenant.update).toHaveBeenCalled()
  })

  it('ADMIN avec un autre admin actif → scope user (garde-fou)', async () => {
    tx.user.findUnique.mockResolvedValue({ id: 'a2', tenantId: 't1', role: 'ADMIN', deletedAt: null })
    tx.user.count.mockResolvedValue(1)

    const r = await deleteAccount('a2')

    expect(r).toEqual({ scope: 'user' })
    expect(tx.tenant.update).not.toHaveBeenCalled()
    expect(tx.user.update).toHaveBeenCalledTimes(1)
  })

  it('compte déjà supprimé → AccountDeletionError ALREADY_DELETED', async () => {
    tx.user.findUnique.mockResolvedValue({ id: 'u1', tenantId: 't1', role: 'CASHIER', deletedAt: new Date() })
    await expect(deleteAccount('u1')).rejects.toMatchObject({ code: 'ALREADY_DELETED' })
    expect(tx.user.update).not.toHaveBeenCalled()
  })

  it('user introuvable → AccountDeletionError USER_NOT_FOUND', async () => {
    tx.user.findUnique.mockResolvedValue(null)
    await expect(deleteAccount('x')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' })
  })
})
