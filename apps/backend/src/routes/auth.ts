import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { sendWelcomeEmail } from '../services/email'
import type { LoginBody, RegisterBody } from '../types'

// Résumé d'une boutique accessible, exposé au frontend (sélecteur / switcher).
export interface AccessibleTenant {
  id: string
  name: string
  currency: string
  plan: string
  logo: string | null
  address: string | null
  role: string // rôle de l'user DANS cette boutique (peut différer du User.role global)
}

/**
 * Liste les boutiques accessibles à un user via UserTenant (actives, non supprimées).
 * Rétro-compat : si aucune liaison (user antérieur au backfill), retombe sur User.tenantId.
 */
export async function accessibleTenants(userId: string, fallbackTenantId?: string, fallbackRole?: string): Promise<AccessibleTenant[]> {
  const links = await prisma.userTenant.findMany({
    where: { userId, tenant: { deletedAt: null } },
    select: {
      role: true,
      tenant: { select: { id: true, name: true, currency: true, plan: true, logo: true, address: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  const list = links
    .filter(l => l.tenant)
    .map(l => ({ id: l.tenant.id, name: l.tenant.name, currency: l.tenant.currency, plan: l.tenant.plan, logo: l.tenant.logo, address: l.tenant.address, role: l.role }))

  if (list.length === 0 && fallbackTenantId) {
    const t = await prisma.tenant.findFirst({ where: { id: fallbackTenantId, deletedAt: null }, select: { id: true, name: true, currency: true, plan: true, logo: true, address: true } })
    if (t) list.push({ ...t, role: fallbackRole ?? 'CASHIER' })
  }
  return list
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Jeton avec boutique active (single tenant ou après switch). role = rôle PAR boutique.
  const signActive = (userId: string, role: string, tenantId: string) =>
    app.jwt.sign({ userId, role, tenantId, activeTenantId: tenantId }, { expiresIn: '7d' })
  // Jeton SANS boutique active (multi-boutiques : sélection requise avant d'entrer).
  const signNoTenant = (userId: string, role: string) =>
    app.jwt.sign({ userId, role, tenantId: null, activeTenantId: null }, { expiresIn: '7d' })
  app.post('/api/auth/login', {
    config: {
      rateLimit: {
        // 30/15min/IP : compromis brute-force ↔ CGNAT mobile (Afrique de l'Ouest), où de nombreux
        // utilisateurs légitimes partagent une même IP publique opérateur (max:10 les épuisait).
        max: 30,
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

    const tenants = await accessibleTenants(user.id, user.tenantId, user.role)

    const baseUser = { id: user.id, name: user.name, email: user.email }

    // 1 seule boutique → connexion directe (comportement historique), boutique active = celle-ci.
    if (tenants.length === 1) {
      const t = tenants[0]
      const token = signActive(user.id, t.role, t.id)
      const tenant = await prisma.tenant.findUnique({ where: { id: t.id } })
      return {
        token,
        user: { ...baseUser, role: t.role, shopName: tenant?.name ?? 'HabaShop' },
        tenant,
        tenants,
        activeTenantId: t.id,
      }
    }

    // 0 ou >1 boutiques → pas de boutique active : le frontend affiche le sélecteur
    // (ou un message « Aucune boutique » si la liste est vide).
    const token = signNoTenant(user.id, user.role)
    return {
      token,
      user: { ...baseUser, role: user.role, shopName: 'HabaShop' },
      tenant: null,
      tenants,
      activeTenantId: null,
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
      // Liaison multi-boutiques : le créateur est ADMIN de sa boutique.
      await tx.userTenant.create({ data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' } })
      return { tenant, user }
    })

    const token = signActive(user.id, user.role, tenant.id)

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
    const { userId, role } = request.user
    const activeTenantId = request.tenantId as string | null
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new Error('Utilisateur introuvable')
    // Boutique active (peut différer du User.tenantId en multi-boutiques).
    const tenant = activeTenantId ? await prisma.tenant.findUnique({ where: { id: activeTenantId } }) : null
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: role ?? user.role,
      shopName: tenant?.name,
      currency: tenant?.currency,
    }
  })

  // ── Multi-boutiques ──────────────────────────────────────────────────────────
  // Liste des boutiques accessibles à l'user courant (sélecteur / switcher).
  app.get('/api/auth/tenants', { preHandler: authenticate }, async (request) => {
    const { userId } = request.user
    return accessibleTenants(userId)
  })

  // Bascule de boutique active : émet un nouveau JWT (activeTenantId = boutique choisie).
  app.post('/api/auth/switch-tenant', {
    preHandler: authenticate,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { userId } = request.user
    const { tenantId } = (request.body ?? {}) as { tenantId?: string }
    if (!tenantId) return reply.code(400).send({ error: 'tenantId requis' })

    // L'user doit avoir accès à cette boutique via UserTenant (source autoritaire).
    const link = await prisma.userTenant.findUnique({
      where: { userId_tenantId: { userId, tenantId } },
      select: { role: true, tenant: { select: { id: true, name: true, currency: true, plan: true, logo: true, address: true, deletedAt: true } } },
    })
    if (!link || !link.tenant || link.tenant.deletedAt) {
      return reply.code(403).send({ error: 'Accès refusé à cette boutique' })
    }

    const token = signActive(userId, link.role, tenantId)
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    return { token, tenant, activeTenantId: tenantId, role: link.role }
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
