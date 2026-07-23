import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { writeAudit } from '../lib/writeAudit'
import { getTenantId } from '../lib/tenantId'
import { invalidateTenantSpendInfo } from '../lib/spend/spendGuard'
import { authenticate } from '../middleware/authenticate'
import type { BillingBody } from '../types'

const PLAN_PRICES: Record<string, Record<string, number>> = {
  pro:        { monthly: 24900, yearly: 249000 },
  enterprise: { monthly: 49900, yearly: 499000 },
}
const VALID_PAYMENTS = ['wave', 'orange_money', 'mtn_money', 'virement', 'card']

/**
 * Routes de facturation HabaShop. Flux : le tenant demande un upgrade
 * (`POST /request-plan`, status `pending`), puis un super-admin valide
 * (`PATCH /api/admin/plan-requests/:id`) → tenant `active` sur le nouveau plan.
 * Méthodes de paiement : Wave, Orange Money, MTN Money, virement, carte.
 */
export async function billingRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Crée une demande d'upgrade de plan (validée ensuite manuellement par le super-admin).
   * @route POST /api/billing/request-plan — auth requise, 3 requêtes/heure.
   * @returns 201 demande créée · 400 plan/période/méthode invalide · 429 quota dépassé.
   */
  app.post('/api/billing/request-plan', { preHandler: authenticate, config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async (request, reply) => {
    const { userId } = request.user
    const { plan, period, paymentMethod, paymentRef, notes } = (request.body ?? {}) as BillingBody

    if (!['pro', 'enterprise'].includes(plan)) {
      return reply.code(400).send({ error: 'Plan invalide. Choisissez pro ou enterprise.' })
    }
    if (!['monthly', 'yearly'].includes(period)) {
      return reply.code(400).send({ error: 'Période invalide. Choisissez monthly ou yearly.' })
    }
    if (!VALID_PAYMENTS.includes(paymentMethod)) {
      return reply.code(400).send({ error: 'Méthode de paiement invalide.' })
    }
    // Après les gardes 400 : `getTenantId` peut lever, l'ordre des sorties reste identique.
    const tenantId = getTenantId(request)
    const amount = PLAN_PRICES[plan]?.[period] ?? PLAN_PRICES[plan]?.monthly ?? 24900

    const planRequest = await prisma.planRequest.create({
      data: {
        tenantId,
        plan,
        period: period === 'yearly' ? 'yearly' : 'monthly',
        amount,
        paymentMethod,
        paymentRef: paymentRef?.trim() || null,
        notes: notes?.trim() || null,
        status: 'pending',
      },
      include: { tenant: true },
    })

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'pending_payment',
        planRequestedAt: new Date(),
        paymentMethod,
        paymentRef: paymentRef?.trim() || null,
      },
    })

    await writeAudit('PLAN_REQUEST', prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        module: 'billing',
        action: 'PLAN_REQUEST',
        description: JSON.stringify({ plan, period, amount, paymentMethod }),
      },
    }))

    console.log(`💰 Demande plan ${plan} pour tenant ${planRequest.tenant.name}`)

    return reply.code(201).send({
      message: 'Demande envoyée avec succès',
      request: { id: planRequest.id, plan, period: planRequest.period, amount, paymentMethod, status: 'pending', estimatedDelay: '24-48h' },
    })
  })

  // Statut actuel du tenant + jours d'essai restants
  app.get('/api/billing/status', { preHandler: authenticate }, async (request, reply) => {
    const tenantId = getTenantId(request)

    const [tenant, pendingRequest] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, plan: true, status: true, trialEnds: true, planActivatedAt: true, paymentMethod: true, isActive: true },
      }),
      prisma.planRequest.findFirst({ where: { tenantId, status: 'pending' }, orderBy: { createdAt: 'desc' } }),
    ])

    if (!tenant) return reply.code(404).send({ error: 'Tenant introuvable' })

    const trialDaysLeft = tenant.trialEnds
      ? Math.max(0, Math.ceil((new Date(tenant.trialEnds).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0
    const isTrialExpired = tenant.status === 'trial' && trialDaysLeft === 0

    if (isTrialExpired && tenant.isActive) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'suspended', suspendedAt: new Date(), suspendReason: 'trial_expired', isActive: false },
      })
      // Le garde de dépense cache le statut 60 s → sans ça, la boutique suspendue
      // continuerait à dépenser jusqu'à une minute après la bascule.
      await invalidateTenantSpendInfo([tenantId])
    }

    return {
      plan: tenant.plan,
      status: isTrialExpired ? 'suspended' : tenant.status,
      trialDaysLeft,
      isTrialExpired,
      planActivatedAt: tenant.planActivatedAt,
      hasPendingRequest: !!pendingRequest,
      pendingRequest: pendingRequest
        ? { id: pendingRequest.id, plan: pendingRequest.plan, period: pendingRequest.period, amount: pendingRequest.amount, paymentMethod: pendingRequest.paymentMethod, status: pendingRequest.status, createdAt: pendingRequest.createdAt }
        : null,
      canUpgrade: tenant.status === 'trial' || tenant.status === 'active',
      canContinue: tenant.status === 'active' || trialDaysLeft > 0,
    }
  })
}
