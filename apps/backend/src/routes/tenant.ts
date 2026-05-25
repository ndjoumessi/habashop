import type { FastifyInstance } from 'fastify'
import type { TenantUpdateBody, InviteUserBody } from '../types'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'

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
      where: { tenantId: request.tenantId },
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
    const { passwordHash: _ph, twoFASecret: _2fa, ...safe } = user
    return reply.code(201).send(safe)
  })
}
