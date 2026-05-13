import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authenticator } from 'otplib'
import qrcode from 'qrcode'
import { prisma } from '../utils/prisma'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantSlug: z.string(),
})

const totpSchema = z.object({
  token: z.string().length(6),
  tempToken: z.string(),
})

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post('/login', async (req, reply) => {
    const { email, password, tenantSlug } = loginSchema.parse(req.body)

    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } })
    if (!tenant) return reply.code(404).send({ error: 'Boutique introuvable' })

    const user = await prisma.user.findFirst({
      where: { email, tenantId: tenant.id, active: true }
    })
    if (!user) return reply.code(401).send({ error: 'Identifiants incorrects' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return reply.code(401).send({ error: 'Identifiants incorrects' })

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })

    if (user.totpEnabled) {
      // Émettre un token temporaire
      const tempToken = app.jwt.sign({ userId: user.id, phase: '2fa' }, { expiresIn: '5m' })
      return { requires2FA: true, tempToken }
    }

    const accessToken = app.jwt.sign(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      { expiresIn: '15m' }
    )
    const refreshToken = app.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    )

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shopName: tenant.name }
    }
  })

  // POST /api/auth/2fa/verify
  app.post('/2fa/verify', async (req, reply) => {
    const { token, tempToken } = totpSchema.parse(req.body)

    let payload: any
    try { payload = app.jwt.verify(tempToken) }
    catch { return reply.code(401).send({ error: 'Token expiré' }) }

    if (payload.phase !== '2fa') return reply.code(401).send({ error: 'Token invalide' })

    const user = await prisma.user.findUnique({ where: { id: payload.userId } })
    if (!user?.totpSecret) return reply.code(401).send({ error: 'TOTP non configuré' })

    const valid = authenticator.verify({ token, secret: user.totpSecret })
    if (!valid) return reply.code(401).send({ error: 'Code TOTP invalide' })

    const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId } })

    const accessToken = app.jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: '15m' }
    )
    const refreshToken = app.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    )

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shopName: tenant?.name }
    }
  })

  // POST /api/auth/2fa/setup — Générer un secret TOTP
  app.post('/2fa/setup', { onRequest: [app.authenticate] }, async (req, reply) => {
    const { userId } = (req.user as any)
    const secret = authenticator.generateSecret()
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) return reply.code(404).send({ error: 'Utilisateur introuvable' })

    const otpauth = authenticator.keyuri(user.email, 'HabaShop', secret)
    const qrCode = await qrcode.toDataURL(otpauth)

    await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } })

    return { secret, qrCode }
  })

  // POST /api/auth/refresh
  app.post('/refresh', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string }
    let payload: any
    try { payload = app.jwt.verify(refreshToken) }
    catch { return reply.code(401).send({ error: 'Refresh token invalide' }) }

    if (payload.type !== 'refresh') return reply.code(401).send({ error: 'Token invalide' })

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { tenant: true }
    })
    if (!user?.active) return reply.code(401).send({ error: 'Compte inactif' })

    const accessToken = app.jwt.sign(
      { userId: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: '15m' }
    )

    return { accessToken }
  })
}

// Décorer app avec authenticate
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: any
  }
}
