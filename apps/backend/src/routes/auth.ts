import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { normalizeCountry } from '../lib/country'
import { writeAudit } from '../lib/writeAudit'
import { authenticate } from '../middleware/authenticate'
import { sendWelcomeEmail } from '../services/email'
import type { LoginBody, RegisterBody } from '../types'
import { DEFAULT_PLAN_ON_SIGNUP } from '../lib/plans'

// ── Schémas de validation (item 6) ──────────────────────────────────────────
// Login : PERMISSIF (présence seule) — la vérif des identifiants reste un 401 générique.
const LOGIN_BODY = z.object({
  email:    z.string().min(1),
  password: z.string().min(1),
})
// Register : email + mot de passe ≥ 8 (parité avec le changement de mdp) ; le reste optionnel.
const REGISTER_BODY = z.object({
  email:    z.string().trim().min(1),
  password: z.string().min(8, { message: 'Le mot de passe doit faire au moins 8 caractères' }),
  name:     z.string().optional(),
  ownerName: z.string().optional(),
  shopName: z.string().optional(),
  currency: z.string().optional(),
  country:  z.string().optional(),
  language: z.string().optional(),
  phone:    z.string().optional(),
}).passthrough()
const SWITCH_TENANT_BODY = z.object({ tenantId: z.string().min(1) })
// Force du nouveau mdp (≥8) conservée dans le handler → message métier inchangé.
const PASSWORD_BODY = z.object({
  currentPassword: z.string().optional(),
  newPassword:     z.string().optional(),
}).passthrough()

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
  // isPlatformAdmin = statut super-admin SaaS (per-user, hors rôle tenant), signé serveur.
  const signActive = (userId: string, role: string, tenantId: string, isPlatformAdmin = false) =>
    app.jwt.sign({ userId, role, tenantId, activeTenantId: tenantId, isPlatformAdmin }, { expiresIn: '7d' })
  // Jeton SANS boutique active (multi-boutiques : sélection requise avant d'entrer).
  const signNoTenant = (userId: string, role: string, isPlatformAdmin = false) =>
    app.jwt.sign({ userId, role, tenantId: null, activeTenantId: null, isPlatformAdmin }, { expiresIn: '7d' })
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
    schema: { body: LOGIN_BODY },
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
      const token = signActive(user.id, t.role, t.id, user.isPlatformAdmin)
      const tenant = await prisma.tenant.findUnique({ where: { id: t.id } })
      return {
        token,
        user: { ...baseUser, role: t.role, shopName: tenant?.name ?? 'HabaShop', isPlatformAdmin: user.isPlatformAdmin },
        tenant,
        tenants,
        activeTenantId: t.id,
      }
    }

    // 0 ou >1 boutiques → pas de boutique active : le frontend affiche le sélecteur
    // (ou un message « Aucune boutique » si la liste est vide).
    const token = signNoTenant(user.id, user.role, user.isPlatformAdmin)
    return {
      token,
      user: { ...baseUser, role: user.role, shopName: 'HabaShop', isPlatformAdmin: user.isPlatformAdmin },
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
    schema: { body: REGISTER_BODY },
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
          // ISO-2 canonique. Le repli 'SN' est HISTORIQUE et assumé (colonne non nullable) —
          // mais il ne doit jamais transformer un libellé en pays deviné : `normalizeCountry`
          // rend null sur l'inconnu, et c'est ce null qui retombe sur le défaut, explicitement.
          country: normalizeCountry(country) ?? 'SN',
          plan: DEFAULT_PLAN_ON_SIGNUP,
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
      plan:      DEFAULT_PLAN_ON_SIGNUP,
    }).catch(() => {})

    return reply.code(201).send({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, shopName: tenant.name, isPlatformAdmin: user.isPlatformAdmin },
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
      isPlatformAdmin: user.isPlatformAdmin,
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
    schema: { body: SWITCH_TENANT_BODY },
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

    // Statut plateforme relu depuis la DB (et non du JWT courant) → une révocation
    // prend effet au prochain switch, sans attendre l'expiration du token.
    const owner = await prisma.user.findUnique({ where: { id: userId }, select: { isPlatformAdmin: true } })
    const token = signActive(userId, link.role, tenantId, owner?.isPlatformAdmin ?? false)
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
    return { token, tenant, activeTenantId: tenantId, role: link.role }
  })

  app.patch('/api/auth/password', { preHandler: authenticate, schema: { body: PASSWORD_BODY } }, async (request, reply) => {
    const { userId } = request.user
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

    // Événement d'échelle UTILISATEUR : il n'appartient à aucune boutique.
    // Écrit dans UserAuditLog (jamais AuditLog, tenant-scopé) — c'est précisément
    // l'écriture qui était silencieusement perdue pour un utilisateur
    // multi-boutiques sans boutique active, cette route étant exemptée du garde
    // NO_ACTIVE_TENANT. Les instantanés e-mail/nom gardent la ligne lisible si le
    // compte est supprimé plus tard.
    await writeAudit('USER_PASSWORD_CHANGE', prisma.userAuditLog.create({
      data: {
        userId,
        userEmailSnapshot: user.email,
        userNameSnapshot:  user.name,
        action:            'PASSWORD_CHANGE',
        description:       'Mot de passe modifié',
        ip:                request.ip,
        severity:          'info',
      },
    }))

    return { success: true, message: 'Mot de passe modifié' }
  })
}
