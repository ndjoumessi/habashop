import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { sendWelcomeEmail } from '../services/email'
import type { LoginBody, RegisterBody } from '../types'

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
        errorResponseBuilder: (_req: any, context: any) => ({
          statusCode: 429,
          error: 'Too Many Requests',
          // context.ttl = ms restants (number) ; context.after = libellé (string) → diviser `after`
          // donnait « NaN minute(s) ». On calcule les minutes depuis ttl.
          message: `Trop de tentatives. Réessayez dans ${Math.max(1, Math.ceil((context.ttl ?? 0) / 60000))} minute(s).`,
          retryAfter: Math.ceil((context.ttl ?? 0) / 1000),
        }),
      },
    },
  }, async (request, reply) => {
    const { email, password } = request.body as LoginBody

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.code(401).send({ error: 'Email ou mot de passe incorrect' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return reply.code(401).send({ error: 'Email ou mot de passe incorrect' })

    if (!user.isActive) return reply.code(403).send({ error: 'Compte désactivé' })

    const token = app.jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: '7d' }
    )

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } })

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        shopName: tenant?.name ?? 'HabaShop',
      },
      tenant,
    }
  })

  app.post('/api/auth/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '1 hour',
        errorResponseBuilder: (_req: any, context: any) => ({
          statusCode: 429,
          error: 'Too Many Requests',
          message: `Trop d'inscriptions. Réessayez dans ${Math.max(1, Math.ceil((context.ttl ?? 0) / 60000))} minute(s).`,
          retryAfter: Math.ceil((context.ttl ?? 0) / 1000),
        }),
      },
    },
  }, async (request, reply) => {
    const { name, ownerName, email, password, shopName, currency, country, language, phone } = request.body as RegisterBody
    const resolvedName = name ?? ownerName ?? shopName

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return reply.code(409).send({ error: 'Email déjà utilisé' })

    const passwordHash = await bcrypt.hash(password, 12)

    const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)

    const { tenant, user } = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: shopName ?? resolvedName,
          currency: currency ?? 'XOF',
          country: country ?? 'SN',
          plan: 'starter',
          status: 'trial',
          isActive: true,
          trialEnds,
        },
      })
      const user = await tx.user.create({
        data: { name: resolvedName, email, passwordHash, role: 'ADMIN', tenantId: tenant.id },
      })
      return { tenant, user }
    })

    const token = app.jwt.sign(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      { expiresIn: '7d' }
    )

    // Email de bienvenue — non-bloquant : ne doit jamais faire échouer l'inscription
    sendWelcomeEmail({
      to:        email,
      shopName:  tenant.name,
      ownerName: user.name ?? resolvedName,
      plan:      'starter',
    }).catch(() => {})

    return reply.code(201).send({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shopName: tenant.name },
      tenant: { ...tenant, trialDaysLeft: 14, canUpgrade: true },
    })
  })

  app.get('/api/auth/me', { preHandler: authenticate }, async (request) => {
    const { userId } = request.user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    })
    if (!user) throw new Error('Utilisateur introuvable')
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      shopName: user.tenant?.name,
      currency: user.tenant?.currency,
    }
  })

  app.patch('/api/auth/password', { preHandler: authenticate }, async (request, reply) => {
    const { userId, tenantId } = request.user
    const { currentPassword, newPassword } = request.body as { currentPassword?: string; newPassword?: string }

    if (!newPassword || newPassword.length < 8) {
      return reply.code(400).send({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.code(404).send({ error: 'Utilisateur introuvable' })

    const valid = await bcrypt.compare(currentPassword ?? '', user.passwordHash)
    if (!valid) return reply.code(401).send({ error: 'Mot de passe actuel incorrect' })

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } })

    await prisma.auditLog.create({
      data: { tenantId, userId, module: 'AUTH', action: 'CHANGE_PASSWORD', description: 'Mot de passe modifié', severity: 'info' },
    }).catch(() => {})

    return { success: true, message: 'Mot de passe modifié' }
  })
}
