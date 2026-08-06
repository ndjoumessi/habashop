import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { AdminReviewBody } from '../types'
import bcrypt from 'bcryptjs'
import { prisma, basePrisma } from '../db'
import { normalizeCountry } from '../lib/country'
import { invalidateTenantSpendInfo } from '../lib/spend/spendGuard'
import { authenticateAdmin } from '../middleware/superAdmin'
import { planAmountXOF } from '../lib/plans'
import { DEFAULT_MARKET } from '../lib/defaultMarket'
import {
  sendUpgradeConfirmation,
  sendWelcomeEmail,
  sendTrialReminder7Days,
  sendTrialReminder3Days,
  sendTrialExpired,
  sendWeeklyReport,
} from '../services/email'

// Création de boutique par l'admin PLATEFORME. `name` requis (Tenant.name non-nullable
// sans défaut) → rejet 400 propre au lieu d'un 500 Prisma. Le reste est optionnel :
// currency/country/plan ont un @default en base ET un repli dans le handler ; on ne
// resserre PAS leur validation (une valeur inédite était acceptée avant, elle le reste).
const ADMIN_CREATE_TENANT = z.object({
  name:          z.string().trim().min(1, { message: 'Le nom de la boutique est requis' }),
  currency:      z.string().optional(),
  country:       z.string().optional(),
  plan:          z.string().optional(),
  adminEmail:    z.string().optional(),
  adminPassword: z.string().optional(),
}).passthrough()

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/admin/tenants', { preHandler: authenticateAdmin }, async () => {
    const tenants = await prisma.tenant.findMany({
      where: { isPlatform: false }, // exclure les tenants INTERNES plateforme (staff)
      include: { _count: { select: { users: true, products: true, sales: true } } },
      orderBy: { createdAt: 'desc' },
    })
    // Agrégat par boutique — CA (refunded exclu) + dernière activité (dernière vente).
    // ⚠️ Cross-tenant légitime → basePrisma (le client étendu scoperait Sale sur le
    // tenant du contexte ; les routes admin lisent TOUTES les boutiques).
    const perTenant = await basePrisma.sale.groupBy({
      by: ['tenantId'],
      where: { status: { not: 'refunded' } },
      _sum: { total: true },
      _max: { createdAt: true },
    })
    const byTenant = new Map(perTenant.map(r => [r.tenantId, r]))
    return tenants.map(t => ({
      ...t,
      revenue: byTenant.get(t.id)?._sum.total ?? 0,
      lastActivityAt: byTenant.get(t.id)?._max.createdAt ?? null,
    }))
  })

  app.get('/api/admin/stats', { preHandler: authenticateAdmin }, async () => {
    // Sale/Product sont scopés par l'extension → basePrisma pour les totaux plateforme.
    // Tenants INTERNES plateforme (isPlatform) exclus de TOUS les totaux (boutiques,
    // users, ventes, produits) → métriques SaaS = boutiques CLIENTES uniquement.
    const [tenants, users, sales, products] = await Promise.all([
      prisma.tenant.count({ where: { isPlatform: false } }),
      basePrisma.user.count({ where: { tenant: { isPlatform: false } } }),
      basePrisma.sale.aggregate({ where: { status: { not: 'refunded' }, tenant: { isPlatform: false } }, _sum: { total: true }, _count: true }),
      basePrisma.product.count({ where: { tenant: { isPlatform: false } } }),
    ])
    return {
      totalTenants: tenants,
      totalUsers: users,
      totalSales: sales._count,
      totalRevenue: sales._sum.total ?? 0,
      totalProducts: products,
    }
  })

  app.post('/api/admin/tenants', { preHandler: authenticateAdmin, schema: { body: ADMIN_CREATE_TENANT } }, async (request) => {
    // Type DÉRIVÉ du schéma : `name` est `string` (garanti par `z.string().min(1)`),
    // plus `string | undefined` comme le laissait croire l'ancien cast. Sans ce schéma,
    // un POST sans `name` atteignait `prisma.tenant.create` (Tenant.name requis) → 500 ;
    // il est désormais rejeté 400 { code:'VALIDATION' } avant le handler.
    const { name, currency, country, plan, adminEmail, adminPassword } = request.body as z.infer<typeof ADMIN_CREATE_TENANT>
    const tenant = await prisma.tenant.create({
      data: { name, currency: currency ?? DEFAULT_MARKET.currency, country: normalizeCountry(country) ?? DEFAULT_MARKET.country, plan: plan ?? 'starter' },
    })
    if (adminEmail && adminPassword) {
      await prisma.user.create({
        data: {
          name: `Admin ${name}`,
          email: adminEmail,
          passwordHash: await bcrypt.hash(adminPassword, 12),
          role: 'ADMIN',
          tenantId: tenant.id,
        },
      })
    }
    return tenant
  })

  // SUPER_ADMIN : demandes en attente
  // Vue TRANSVERSE des événements de sécurité utilisateur (supervision plateforme).
  // `basePrisma` : UserAuditLog n'a pas de tenantId et n'est pas dans la liste
  // scopée de l'extension — on passe par le client non étendu pour que ce soit
  // explicite plutôt qu'implicite.
  // ⚠️ L'échec REMONTE : une vue de supervision vide sur erreur ment.
  app.get('/api/admin/security-events', { preHandler: authenticateAdmin }, async (request) => {
    const { limit } = (request.query ?? {}) as { limit?: string }
    const take = Math.min(Math.max(Number(limit) || 100, 1), 500)
    return basePrisma.userAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    })
  })

  app.get('/api/admin/plan-requests', { preHandler: authenticateAdmin }, async () => {
    return prisma.planRequest.findMany({
      where: { status: 'pending' },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    })
  })

  // SUPER_ADMIN : approuver / rejeter une demande
  app.patch('/api/admin/plan-requests/:id', { preHandler: authenticateAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { action, adminNotes } = (request.body ?? {}) as AdminReviewBody
    const { userId } = request.user

    const planRequest = await prisma.planRequest.findUnique({ where: { id }, include: { tenant: true } })
    if (!planRequest) return reply.code(404).send({ error: 'Demande introuvable' })

    if (action === 'approve') {
      await Promise.all([
        prisma.planRequest.update({
          where: { id },
          data: { status: 'approved', adminNotes: adminNotes || null, reviewedAt: new Date(), reviewedBy: userId },
        }),
        prisma.tenant.update({
          where: { id: planRequest.tenantId },
          data: {
            plan: planRequest.plan,
            status: 'active',
            isActive: true,
            planActivatedAt: new Date(),
            trialEnds: new Date(Date.now() + (planRequest.period === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
          },
        }),
      ])
      // Plan activé → le statut caché par le garde de dépense doit être relu tout de suite
      // (sinon le nouveau plafond ne s'applique qu'à la minute suivante).
      await invalidateTenantSpendInfo([planRequest.tenantId])

      // Email de confirmation d'upgrade (non-bloquant)
      const admin = await prisma.user.findFirst({
        where: { tenantId: planRequest.tenantId, role: 'ADMIN' },
      }).catch(() => null)
      if (admin?.email) {
        sendUpgradeConfirmation({
          to:        admin.email,
          shopName:  planRequest.tenant.name,
          ownerName: admin.name ?? planRequest.tenant.name,
          plan:      planRequest.plan,
          amount:    planRequest.amount,
          method:    planRequest.paymentMethod,
          ref:       planRequest.paymentRef ?? undefined,
        }).catch(() => {})
      }

      console.log(`✅ Plan ${planRequest.plan} approuvé pour ${planRequest.tenant.name}`)
      return { message: `Plan ${planRequest.plan} activé`, tenant: planRequest.tenant.name, plan: planRequest.plan, period: planRequest.period }
    }

    if (action === 'reject') {
      await Promise.all([
        prisma.planRequest.update({
          where: { id },
          data: { status: 'rejected', adminNotes: adminNotes || null, reviewedAt: new Date(), reviewedBy: userId },
        }),
        prisma.tenant.update({
          where: { id: planRequest.tenantId },
          data: { status: 'trial', paymentRef: null, paymentMethod: null },
        }),
      ])
      return { message: 'Demande rejetée', tenant: planRequest.tenant.name }
    }

    return reply.code(400).send({ error: 'Action invalide. Utilisez approve ou reject.' })
  })

  // ─── Test email (dev uniquement) ────────────
  app.post('/api/admin/test-email', { preHandler: authenticateAdmin }, async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.code(403).send({ error: 'Dev only' })
    }

    const { type = 'welcome' } = (request.body ?? {}) as { type?: string }

    const testData = {
      to:        'test@habashop.vercel.app',
      shopName:  'Épicerie Test Dakar',
      ownerName: 'Mamadou Diallo',
      plan:      'business',
      amount:    planAmountXOF('business', 'monthly') ?? 0,
      method:    'wave',
      ref:       'WV-TEST-123456',
      caToday:   450000,
      txCount:   18,
      currency:  'XOF',
      caWeek:    2800000,
      txWeek:    112,
      caLastWeek: 2400000,
      topProduct: 'Riz parfumé 5kg',
      lowStock:  3,
    }

    const senders: Record<string, () => Promise<boolean>> = {
      welcome: () => sendWelcomeEmail(testData),
      remind7: () => sendTrialReminder7Days(testData),
      remind3: () => sendTrialReminder3Days(testData),
      expired: () => sendTrialExpired(testData),
      upgrade: () => sendUpgradeConfirmation(testData),
      // Le rapport hebdo est un e-mail OPÉRATIONNEL (gardé) : le test l'émet au nom
      // du tenant de l'admin plateforme, exclu des quotas comme des listings.
      // ⚠️ Route platform-scopée (authenticateAdmin, dev-only) : un admin plateforme peut
      // n'avoir AUCUNE boutique active → tenantId null. `?? ''` satisfait le typage sans
      // changer le comportement (le garde de dépense refuse `''` comme `null` → non envoyé).
      weekly:  () => sendWeeklyReport({ ...testData, tenantId: request.user.tenantId ?? '' }),
    }

    const fn = senders[type]
    if (!fn) {
      return reply.code(400).send({ error: 'Type invalide', types: Object.keys(senders) })
    }

    const ok = await fn()
    return { sent: ok, type }
  })
}
