import type { FastifyInstance } from 'fastify'
import type { TenantUpdateBody, InviteUserBody } from '../types'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { sendUserInvitationEmail } from '../services/email'

export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/tenant', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.tenant.findUnique({ where: { id: tenantId } })
  })

  const updateTenantHandler = async (request) => {
    const tenantId = request.tenantId
    const data = request.body as TenantUpdateBody
    return prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name:     data.name,
        currency: data.currency,
        country:  data.country,
        vatRate:  data.vatRate,
        address:  data.address,
        phone:    data.phone,
        email:    data.email,
      },
    })
  }
  app.put('/api/tenant',   { preHandler: authenticate }, updateTenantHandler)
  app.patch('/api/tenant', { preHandler: authenticate }, updateTenantHandler)

  // ─── TENANT USERS ─────────────────────
  app.get('/api/tenant/users', { preHandler: authenticate }, async (request) => {
    const users = await prisma.user.findMany({
      where: { tenantId: request.tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
    return users.map(({ passwordHash, twoFASecret, ...u }) => u)
  })

  app.post('/api/tenant/users', { preHandler: authenticate }, async (request, reply) => {
    const { name, email, password, role } = request.body as InviteUserBody
    if (!name?.trim() || !email?.trim() || !password) {
      return reply.code(400).send({ error: 'Nom, email et mot de passe requis' })
    }
    const existing = await prisma.user.findUnique({ where: { email: email.trim() } })
    if (existing) return reply.code(409).send({ error: 'Email déjà utilisé' })
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        passwordHash,
        role: role ?? 'CASHIER',
        tenantId: request.tenantId,
      },
    })
    // Audit + email (best-effort, n'échoue pas l'invitation si l'email rate)
    const tenant = await prisma.tenant.findUnique({ where: { id: request.tenantId } })
    const inviter = await prisma.user.findUnique({ where: { id: request.user.userId } })
    await prisma.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: request.user.userId,
        module: 'USERS',
        action: 'INVITE_USER',
        description: JSON.stringify({ invitedUserId: user.id, email: user.email, role: user.role }),
        severity: 'info',
      },
    }).catch(() => {})
    sendUserInvitationEmail({
      to: user.email,
      inviteeName: user.name,
      shopName: tenant?.name ?? 'HabaShop',
      tempPassword: password,
      invitedBy: inviter?.name,
    }).catch(err => console.warn('invite email failed:', err?.message))

    const { passwordHash: _ph, twoFASecret: _2fa, ...safe } = user
    return reply.code(201).send(safe)
  })

  app.put('/api/tenant/users/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { name?: string; email?: string; role?: string }
    const existing = await prisma.user.findFirst({ where: { id, tenantId: request.tenantId, deletedAt: null } })
    if (!existing) return reply.code(404).send({ error: 'Utilisateur introuvable' })
    // Si l'email change, vérifier unicité globale
    if (body.email && body.email.trim() !== existing.email) {
      const dup = await prisma.user.findUnique({ where: { email: body.email.trim() } })
      if (dup) return reply.code(409).send({ error: 'Email déjà utilisé' })
    }
    const updated = await prisma.user.update({
      where: { id },
      data: {
        name:  body.name?.trim() ?? undefined,
        email: body.email?.trim() ?? undefined,
        role:  body.role ?? undefined,
      },
    })
    await prisma.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: request.user.userId,
        module: 'USERS',
        action: 'UPDATE_USER',
        description: JSON.stringify({ targetUserId: id }),
        severity: 'info',
      },
    }).catch(() => {})
    const { passwordHash, twoFASecret, ...safe } = updated
    return safe
  })

  app.patch('/api/tenant/users/:id/active', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { active } = request.body as { active?: boolean }
    if (typeof active !== 'boolean') return reply.code(400).send({ error: 'active (boolean) requis' })
    if (id === request.user.userId) return reply.code(403).send({ error: 'Vous ne pouvez pas désactiver votre propre compte' })
    const existing = await prisma.user.findFirst({ where: { id, tenantId: request.tenantId, deletedAt: null } })
    if (!existing) return reply.code(404).send({ error: 'Utilisateur introuvable' })
    // Empêcher la désactivation du dernier admin actif
    if (!active && existing.role === 'ADMIN' && existing.isActive) {
      const remainingAdmins = await prisma.user.count({
        where: { tenantId: request.tenantId, role: 'ADMIN', isActive: true, deletedAt: null, NOT: { id } },
      })
      if (remainingAdmins === 0) return reply.code(403).send({ error: 'Impossible de désactiver le dernier administrateur actif' })
    }
    const updated = await prisma.user.update({ where: { id }, data: { isActive: active } })
    await prisma.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: request.user.userId,
        module: 'USERS',
        action: 'TOGGLE_USER_ACTIVE',
        description: JSON.stringify({ targetUserId: id, active }),
        severity: 'info',
      },
    }).catch(() => {})
    const { passwordHash, twoFASecret, ...safe } = updated
    return safe
  })

  app.patch('/api/tenant/users/:id/2fa', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { twoFA } = request.body as { twoFA?: boolean }
    if (typeof twoFA !== 'boolean') return reply.code(400).send({ error: 'twoFA (boolean) requis' })
    const existing = await prisma.user.findFirst({ where: { id, tenantId: request.tenantId, deletedAt: null } })
    if (!existing) return reply.code(404).send({ error: 'Utilisateur introuvable' })
    const updated = await prisma.user.update({ where: { id }, data: { twoFAEnabled: twoFA } })
    await prisma.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: request.user.userId,
        module: 'USERS',
        action: 'TOGGLE_USER_2FA',
        description: JSON.stringify({ targetUserId: id, twoFA }),
        severity: 'info',
      },
    }).catch(() => {})
    const { passwordHash, twoFASecret, ...safe } = updated
    return safe
  })

  app.delete('/api/tenant/users/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    if (id === request.user.userId) return reply.code(403).send({ error: 'Vous ne pouvez pas supprimer votre propre compte' })
    const existing = await prisma.user.findFirst({ where: { id, tenantId: request.tenantId, deletedAt: null } })
    if (!existing) return reply.code(404).send({ error: 'Utilisateur introuvable' })
    if (existing.role === 'ADMIN') {
      const remainingAdmins = await prisma.user.count({
        where: { tenantId: request.tenantId, role: 'ADMIN', isActive: true, deletedAt: null, NOT: { id } },
      })
      if (remainingAdmins === 0) return reply.code(403).send({ error: 'Impossible de supprimer le dernier administrateur actif' })
    }
    await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } })
    await prisma.auditLog.create({
      data: {
        tenantId: request.tenantId,
        userId: request.user.userId,
        module: 'USERS',
        action: 'DELETE_USER',
        description: JSON.stringify({ targetUserId: id, email: existing.email }),
        severity: 'warning',
      },
    }).catch(() => {})
    return { success: true }
  })
}
