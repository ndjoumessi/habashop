import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { TenantUpdateBody, InviteUserBody } from '../types'
import { isValidSlug, RESERVED_SLUGS } from '../utils/slug'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import { blockDemoTenant } from '../middleware/demoTenant'
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

  // ── Multi-boutiques : création d'une nouvelle boutique ─────────────────────────
  // Le créateur (ADMIN/SUPER_ADMIN) est automatiquement lié comme ADMIN de la boutique.
  // Réconciliation spec : ADMIN autorisé (et pas seulement SUPER_ADMIN) pour permettre
  // à un propriétaire d'ouvrir une 2ᵉ boutique (cas d'usage central du multi-boutiques).
  // ⚠️ Gardé démo : sans ça, un compte démo crée une boutique NEUVE (isDemo=false par
  // défaut), bascule dessus et retrouve OCR/WhatsApp — le garde serait contournable en
  // deux appels. Cf. demoTenant.test.ts (« évasion par création de boutique »).
  app.post('/api/tenants', { preHandler: [authenticate, blockDemoTenant] }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return
    const { userId } = request.user
    const body = (request.body ?? {}) as { name?: string; currency?: string; lang?: string; address?: string; country?: string; phone?: string }
    const name = body.name?.trim()
    if (!name) return reply.code(400).send({ error: 'Le nom de la boutique est requis' })

    const VALID_CURRENCIES = ['XOF', 'XAF', 'EUR', 'USD', 'CAD', 'GBP']
    const VALID_LANGS = ['fr', 'en', 'es', 'it']
    const currency = VALID_CURRENCIES.includes(body.currency ?? '') ? body.currency! : 'XOF'
    const lang = VALID_LANGS.includes(body.lang ?? '') ? body.lang! : 'fr'

    // ⚠️ La boutique créée HÉRITE du statut de celle du créateur. Sans ça, un compte à
    // l'essai (même expiré) créait une boutique `status:'active'` sans `trialEnds`, y
    // basculait, et retrouvait le plafond du palier PAYANT — deux appels suffisaient à
    // remettre le compteur à zéro autant de fois que voulu.
    const origin = await prisma.tenant.findUnique({
      where: { id: request.tenantId },
      select: { status: true, trialEnds: true, plan: true },
    })
    const inheritedStatus = origin?.status === 'trial' ? 'trial' : (origin?.status ?? 'trial')
    const inheritedTrialEnds = origin?.status === 'trial' ? origin.trialEnds : null

    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          name, currency, lang,
          country: body.country ?? 'SN',
          address: body.address ?? null,
          phone: body.phone ?? null,
          plan: origin?.plan ?? 'starter',
          status: inheritedStatus,
          trialEnds: inheritedTrialEnds,
          isActive: true,
        },
      })
      await tx.userTenant.create({ data: { userId, tenantId: t.id, role: 'ADMIN' } })
      return t
    })

    return reply.code(201).send({ tenant })
  })

  // Invitation d'un employé dans une boutique CHOISIE (multi-boutiques).
  // Le caller doit être ADMIN de cette boutique (via UserTenant) ou SUPER_ADMIN.
  app.post('/api/tenants/:id/invite', { preHandler: [authenticate, blockDemoTenant] }, async (request, reply) => {
    const { id: targetTenantId } = request.params as { id: string }
    const { userId, role: callerRole } = request.user
    const { name, email, password, role } = (request.body ?? {}) as { name?: string; email?: string; password?: string; role?: string }

    // Autorisation : SUPER_ADMIN global, ou ADMIN lié à cette boutique précise.
    const isSuper = String(callerRole).toUpperCase() === 'SUPER_ADMIN'
    if (!isSuper) {
      const callerLink = await prisma.userTenant.findUnique({ where: { userId_tenantId: { userId, tenantId: targetTenantId } }, select: { role: true } })
      if (!callerLink || !isAdminRole(callerLink.role)) {
        return reply.code(403).send({ error: 'Accès réservé à un administrateur de cette boutique' })
      }
    }
    if (!email?.trim()) return reply.code(400).send({ error: 'Email requis' })
    if (role && !VALID_ROLES.includes(role as Role)) {
      return reply.code(400).send({ error: `Rôle invalide. Valides : ${VALID_ROLES.join(', ')}` })
    }
    const tenant = await prisma.tenant.findFirst({ where: { id: targetTenantId, deletedAt: null } })
    if (!tenant) return reply.code(404).send({ error: 'Boutique introuvable' })

    const finalRole = (role as Role) ?? 'CASHIER'
    const existing = await prisma.user.findUnique({ where: { email: email.trim() } })

    // User existant → simple rattachement à la boutique (idempotent).
    if (existing) {
      await prisma.userTenant.upsert({
        where: { userId_tenantId: { userId: existing.id, tenantId: targetTenantId } },
        update: { role: finalRole },
        create: { userId: existing.id, tenantId: targetTenantId, role: finalRole },
      })
      return reply.code(200).send({ linked: true, userId: existing.id })
    }

    // Nouvel user → création + liaison. Mot de passe requis.
    if (!name?.trim() || !password) return reply.code(400).send({ error: 'Nom et mot de passe requis pour un nouvel employé' })
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { name: name.trim(), email: email.trim(), passwordHash, role: finalRole, tenantId: targetTenantId } })
      await tx.userTenant.create({ data: { userId: u.id, tenantId: targetTenantId, role: finalRole } })
      return u
    })
    const inviter = await prisma.user.findUnique({ where: { id: userId } })
    sendUserInvitationEmail({ to: user.email, inviteeName: user.name, shopName: tenant.name, tempPassword: password, invitedBy: inviter?.name }).catch(() => {})
    const { passwordHash: _ph, twoFASecret: _2fa, ...safe } = user
    return reply.code(201).send({ created: true, user: safe })
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
      data.pointsPerAmount !== undefined || data.bronzeThreshold !== undefined || data.silverThreshold !== undefined ||
      data.bronzeDiscount !== undefined || data.silverDiscount !== undefined || data.goldDiscount !== undefined
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
      // Validation remises v2 : [0, 100]
      for (const [k, v] of [
        ['bronzeDiscount', data.bronzeDiscount],
        ['silverDiscount', data.silverDiscount],
        ['goldDiscount',   data.goldDiscount],
      ] as const) {
        if (v !== undefined) {
          const n = Number(v)
          if (!Number.isFinite(n) || n < 0 || n > 100) {
            return reply.code(400).send({ error: `${k} doit être un nombre entre 0 et 100`, code: 'LOYALTY_INVALID' })
          }
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

    // ── Identifiants légaux (pied de facture/devis) : chaînes courtes optionnelles ──
    for (const [k, v] of [['ninea', data.ninea], ['rccm', data.rccm], ['vatNumber', data.vatNumber]] as const) {
      if (v !== undefined && v !== null && (typeof v !== 'string' || v.trim().length > 64)) {
        return reply.code(400).send({ error: `${k} : chaîne de 64 caractères maximum`, code: 'VALIDATION' })
      }
    }
    // '' normalisé en null (efface le champ) — même convention que ownerPhone.
    const legal = (v: string | null | undefined) => v === undefined ? undefined : (v?.trim() || null)

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
        enableAutoWhatsApp: data.enableAutoWhatsApp,
        enableLoyalty:  data.enableLoyalty,
        requireCashier: data.requireCashier,
        enableScanner:  data.enableScanner,
        priceMode:      data.priceMode,
        posDefaultFund: data.posDefaultFund,
        // Fidélité v1 (seuils) + v2 (remises)
        pointsPerAmount: data.pointsPerAmount,
        bronzeThreshold: data.bronzeThreshold,
        silverThreshold: data.silverThreshold,
        bronzeDiscount:  data.bronzeDiscount,
        silverDiscount:  data.silverDiscount,
        goldDiscount:    data.goldDiscount,
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
        // Rapports WhatsApp auto — '' normalisé en null (désactive l'envoi)
        ownerPhone:     data.ownerPhone === undefined ? undefined : (data.ownerPhone?.trim() || null),
        // Identifiants légaux (pied de facture/devis)
        ninea:     legal(data.ninea),
        rccm:      legal(data.rccm),
        vatNumber: legal(data.vatNumber),
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

  app.post('/api/tenant/users', { preHandler: [authenticate, blockDemoTenant] }, async (request, reply) => {
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
    // Liaison multi-boutiques : rattache l'employé à la boutique active.
    await prisma.userTenant.create({
      data: { userId: user.id, tenantId: request.tenantId, role: (role as Role) ?? 'CASHIER' },
    }).catch(() => {})
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

  // Gardé démo au même titre que POST /api/tenant/users : supprimer les comptes de la
  // boutique de démo (mot de passe public) casserait la démo jusqu'à un reseed manuel.
  app.delete('/api/tenant/users/:id', { preHandler: [authenticate, blockDemoTenant] }, async (request, reply) => {
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
