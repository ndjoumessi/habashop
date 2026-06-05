import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { TenantUpdateBody, InviteUserBody } from '../types'
import { isValidSlug, RESERVED_SLUGS } from '../utils/slug'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { sendUserInvitationEmail } from '../services/email'

const VALID_ROLES = ['ADMIN', 'MANAGER', 'CASHIER', 'ACCOUNTANT', 'HR'] as const
type Role = typeof VALID_ROLES[number]

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN'] as const
const isAdminRole = (role: unknown) => typeof role === 'string' && (ADMIN_ROLES as readonly string[]).includes(role)

// Garde rôle ADMIN/SUPER_ADMIN (renvoie true si le caller PEUT continuer, false sinon avec reply envoyée)
function requireAdmin(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!isAdminRole(request.user?.role)) {
    reply.code(403).send({ error: 'Accès réservé aux administrateurs' })
    return false
  }
  return true
}

export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/tenant', { preHandler: authenticate }, async (request) => {
    const { tenantId } = request.user
    return prisma.tenant.findUnique({ where: { id: tenantId } })
  })

  const updateTenantHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.tenantId
    const data = request.body as TenantUpdateBody
    // Option C — lang & devise = settings TENANT stricts : modifiables UNIQUEMENT par
    // ADMIN/SUPER_ADMIN (cohérence pour tous les membres). Tout autre rôle → 403 si le
    // body touche `lang` ou `currency` (les autres champs restent permis à leur niveau).
    const touchesLocale = data.lang !== undefined || data.currency !== undefined
    if (touchesLocale && !isAdminRole(request.user?.role)) {
      return reply.code(403).send({
        error: "Langue et devise : modification réservée à l'administrateur",
        code: 'LOCALE_ADMIN_ONLY',
      })
    }

    // ── Config fidélité : ADMIN/SUPER_ADMIN uniquement + validation ──
    const touchesLoyalty =
      data.pointsPerAmount !== undefined || data.bronzeThreshold !== undefined || data.silverThreshold !== undefined
    if (touchesLoyalty) {
      if (!isAdminRole(request.user?.role)) {
        return reply.code(403).send({ error: "Configuration fidélité : réservée à l'administrateur", code: 'LOYALTY_ADMIN_ONLY' })
      }
      const isPosInt = (v: unknown) => Number.isInteger(v) && (v as number) >= 1
      for (const [k, v] of [
        ['pointsPerAmount', data.pointsPerAmount],
        ['bronzeThreshold', data.bronzeThreshold],
        ['silverThreshold', data.silverThreshold],
      ] as const) {
        if (v !== undefined && !isPosInt(v)) {
          return reply.code(400).send({ error: `${k} doit être un entier positif (≥ 1)`, code: 'LOYALTY_INVALID' })
        }
      }
      // bronze < silver sur les valeurs EFFECTIVES (merge avec l'existant si update partiel).
      const current = await prisma.tenant.findUnique({
        where: { id: tenantId }, select: { bronzeThreshold: true, silverThreshold: true },
      })
      const bronze = data.bronzeThreshold ?? current?.bronzeThreshold ?? 2000
      const silver = data.silverThreshold ?? current?.silverThreshold ?? 5000
      if (bronze >= silver) {
        return reply.code(400).send({ error: 'Le seuil Bronze doit être strictement inférieur au seuil Silver', code: 'LOYALTY_THRESHOLDS' })
      }
    }

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
        lang:     data.lang,
        // POS
        posVatIncluded: data.posVatIncluded,
        posAutoprint:   data.posAutoprint,
        autoWhatsApp:   data.autoWhatsApp,
        enableLoyalty:  data.enableLoyalty,
        requireCashier: data.requireCashier,
        enableScanner:  data.enableScanner,
        priceMode:      data.priceMode,
        posDefaultFund: data.posDefaultFund,
        // Fidélité (config tenant)
        pointsPerAmount: data.pointsPerAmount,
        bronzeThreshold: data.bronzeThreshold,
        silverThreshold: data.silverThreshold,
        // Notifications
        notifEmailSales:   data.notifEmailSales,
        notifEmailStock:   data.notifEmailStock,
        notifEmailPayroll: data.notifEmailPayroll,
        notifSmsSales:     data.notifSmsSales,
        notifSmsStock:     data.notifSmsStock,
        notifPushAll:      data.notifPushAll,
        // Catalogue public
        description:    data.description,
        whatsappPhone:  data.whatsappPhone,
        catalogVisible: data.catalogVisible,
      },
    })
  }
  app.put('/api/tenant',   { preHandler: authenticate }, updateTenantHandler)
  app.patch('/api/tenant', { preHandler: authenticate }, updateTenantHandler)

  // ─── SLUG (catalogue public) ──────────
  // PATCH dédié pour vérifier l'unicité + valider le format avant l'écriture
  app.patch('/api/tenant/slug', { preHandler: authenticate }, async (request, reply) => {
    const tenantId = request.tenantId
    const { slug } = request.body as { slug?: string }
    if (typeof slug !== 'string' || !slug.trim()) {
      return reply.code(400).send({ error: 'Slug requis' })
    }
    const normalized = slug.trim().toLowerCase()
    if (!isValidSlug(normalized)) {
      if (RESERVED_SLUGS.has(normalized)) {
        return reply.code(400).send({ error: 'Ce nom est réservé, choisissez-en un autre' })
      }
      return reply.code(400).send({ error: 'Format invalide : 3-50 caractères, lettres minuscules, chiffres et tirets uniquement' })
    }
    const collision = await prisma.tenant.findFirst({
      where: { slug: normalized, NOT: { id: tenantId } },
    })
    if (collision) {
      return reply.code(409).send({ error: 'Ce lien est déjà pris' })
    }
    return prisma.tenant.update({
      where: { id: tenantId },
      data: { slug: normalized },
    })
  })

  // ─── TENANT USERS ─────────────────────
  app.get('/api/tenant/users', { preHandler: authenticate }, async (request) => {
    const users = await prisma.user.findMany({
      where: { tenantId: request.tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
    return users.map(({ passwordHash, twoFASecret, ...u }) => u)
  })

  app.post('/api/tenant/users', { preHandler: authenticate }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return
    const { name, email, password, role } = request.body as InviteUserBody
    if (!name?.trim() || !email?.trim() || !password) {
      return reply.code(400).send({ error: 'Nom, email et mot de passe requis' })
    }
    if (role && !VALID_ROLES.includes(role as Role)) {
      return reply.code(400).send({ error: `Rôle invalide. Valides : ${VALID_ROLES.join(', ')}` })
    }
    const existing = await prisma.user.findUnique({ where: { email: email.trim() } })
    if (existing) return reply.code(409).send({ error: 'Email déjà utilisé' })
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        passwordHash,
        role: (role as Role) ?? 'CASHIER',
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
    if (!requireAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    const body = request.body as { name?: string; email?: string; role?: string }
    if (body.role && !VALID_ROLES.includes(body.role as Role)) {
      return reply.code(400).send({ error: `Rôle invalide. Valides : ${VALID_ROLES.join(', ')}` })
    }
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
        role:  (body.role as Role | undefined) ?? undefined,
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
    if (!requireAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    const { active } = request.body as { active?: boolean }
    if (typeof active !== 'boolean') return reply.code(400).send({ error: 'active (boolean) requis' })
    if (id === request.user.userId) return reply.code(403).send({ error: 'Vous ne pouvez pas désactiver votre propre compte' })
    const existing = await prisma.user.findFirst({ where: { id, tenantId: request.tenantId, deletedAt: null } })
    if (!existing) return reply.code(404).send({ error: 'Utilisateur introuvable' })
    // Empêcher la désactivation du dernier admin actif
    if (!active && isAdminRole(existing.role) && existing.isActive) {
      const remainingAdmins = await prisma.user.count({
        where: { tenantId: request.tenantId, role: { in: [...ADMIN_ROLES] }, isActive: true, deletedAt: null, NOT: { id } },
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
    // Self-service autorisé (un user peut toggler son propre 2FA) ; sinon ADMIN/SUPER_ADMIN requis
    if (id !== request.user.userId && !isAdminRole(request.user.role)) {
      return reply.code(403).send({ error: 'Accès réservé aux administrateurs ou au propriétaire du compte' })
    }
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
    if (!requireAdmin(request, reply)) return
    const { id } = request.params as { id: string }
    if (id === request.user.userId) return reply.code(403).send({ error: 'Vous ne pouvez pas supprimer votre propre compte' })
    const existing = await prisma.user.findFirst({ where: { id, tenantId: request.tenantId, deletedAt: null } })
    if (!existing) return reply.code(404).send({ error: 'Utilisateur introuvable' })
    if (isAdminRole(existing.role)) {
      const remainingAdmins = await prisma.user.count({
        where: { tenantId: request.tenantId, role: { in: [...ADMIN_ROLES] }, isActive: true, deletedAt: null, NOT: { id } },
      })
      if (remainingAdmins === 0) return reply.code(403).send({ error: 'Impossible de supprimer le dernier administrateur actif' })
    }
    // Suffixe l'email pour libérer la contrainte @unique globale (permet réinvitation immédiate).
    // L'email original reste lisible dans l'audit log ci-dessous + dans le préfixe.
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: `${existing.email}_deleted_${Date.now()}`,
      },
    })
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
