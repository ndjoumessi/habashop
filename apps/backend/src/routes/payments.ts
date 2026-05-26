import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { authenticate } from '../middleware/authenticate'
import {
  createWaveCheckout,
  verifyWaveWebhook,
} from '../services/wave'
import {
  createOMPayment,
} from '../services/orangeMoney'
import { sendUpgradeConfirmation } from '../services/email'

const FRONTEND_URL = process.env.FRONTEND_URL
  ?? 'https://habashop.vercel.app'
const BACKEND_URL = process.env.BACKEND_URL
  ?? 'https://habashop-production.up.railway.app'

const PRICES: Record<string, Record<string, number>> = {
  pro:        { monthly: 24900, yearly: 249000 },
  enterprise: { monthly: 49900, yearly: 499000 },
}

/**
 * Routes de paiement automatique Wave & Orange Money.
 *
 * Flux : le tenant choisit un plan → POST /checkout crée une `PlanRequest`
 * (`status: pending_payment`) et un lien de paiement chez le prestataire →
 * le tenant paie → le prestataire appelle notre webhook → `activatePlan()`
 * passe le tenant en `active`. En l'absence de clés API, les services
 * renvoient des liens sandbox (cf. services/wave.ts & orangeMoney.ts).
 *
 * Note : `paymentRef` reste la référence stable `HABA-…` (= `client_reference`
 * côté Wave et `order_id` côté Orange) car c'est elle qui revient dans les
 * webhooks et l'URL de callback ; le token prestataire est conservé dans
 * `notes` pour le débogage.
 */
export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  // Capture le corps brut (rawBody) pour la vérification de signature des
  // webhooks. Encapsulé : ne s'applique qu'aux routes de ce plugin.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req: any, body: string, done) => {
      req.rawBody = body
      try {
        done(null, body ? JSON.parse(body) : {})
      } catch (err) {
        done(err as Error, undefined)
      }
    }
  )

  // ── POST /api/payments/wave/checkout ─────────
  // Crée un lien de paiement Wave
  app.post('/api/payments/wave/checkout', {
    preHandler: [authenticate],
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request: any, reply: any) => {
    const { plan, period } = (request.body ?? {}) as { plan?: string; period?: string }
    const tenantId = request.tenantId as string

    if (!plan || !period || !PRICES[plan]?.[period]) {
      return reply.code(400).send({ error: 'Plan invalide' })
    }

    const amount    = PRICES[plan][period]
    const reference = `HABA-${tenantId.slice(0, 8)}-${Date.now()}`

    // Enregistre la demande en DB
    const planReq = await prisma.planRequest.create({
      data: {
        tenantId,
        plan,
        period,
        amount,
        paymentMethod: 'wave',
        paymentRef:    reference,
        status:        'pending_payment',
      },
    })

    try {
      const checkout = await createWaveCheckout({
        amount,
        currency:    'XOF',
        description: `HabaShop ${plan} — ${period}`,
        reference,
        redirectUrl: `${FRONTEND_URL}/app/upgrade/callback`,
        webhookUrl:  `${BACKEND_URL}/api/payments/wave/webhook`,
      })

      // Conserve le checkoutId prestataire pour traçabilité (paymentRef reste la réf stable)
      await prisma.planRequest.update({
        where: { id: planReq.id },
        data:  { notes: `wave checkout: ${checkout.checkoutId}` },
      })

      return {
        checkoutUrl: checkout.checkoutUrl,
        checkoutId:  checkout.checkoutId,
        reference,
        amount,
        plan,
        period,
      }
    } catch (err: any) {
      await prisma.planRequest.delete({ where: { id: planReq.id } }).catch(() => {})
      return reply.code(500).send({ error: err.message ?? 'Erreur Wave' })
    }
  })

  // ── POST /api/payments/orange/checkout ───────
  // Initie un paiement Orange Money
  app.post('/api/payments/orange/checkout', {
    preHandler: [authenticate],
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request: any, reply: any) => {
    const { plan, period } = (request.body ?? {}) as { plan?: string; period?: string }
    const tenantId = request.tenantId as string

    if (!plan || !period || !PRICES[plan]?.[period]) {
      return reply.code(400).send({ error: 'Plan invalide' })
    }

    const amount    = PRICES[plan][period]
    const reference = `HABA-OM-${tenantId.slice(0, 8)}-${Date.now()}`

    const planReq = await prisma.planRequest.create({
      data: {
        tenantId,
        plan,
        period,
        amount,
        paymentMethod: 'orange_money',
        paymentRef:    reference,
        status:        'pending_payment',
      },
    })

    try {
      const payment = await createOMPayment({
        amount,
        reference,
        description: `HabaShop ${plan} — ${period}`,
        notifUrl:    `${BACKEND_URL}/api/payments/orange/webhook`,
        returnUrl:   `${FRONTEND_URL}/app/upgrade/callback?status=success&ref=${reference}`,
        cancelUrl:   `${FRONTEND_URL}/app/upgrade/callback?status=cancel&ref=${reference}`,
      })

      await prisma.planRequest.update({
        where: { id: planReq.id },
        data:  { notes: `orange pay_token: ${payment.payToken}` },
      })

      return {
        paymentUrl: payment.paymentUrl,
        payToken:   payment.payToken,
        reference,
        amount,
        plan,
        period,
      }
    } catch (err: any) {
      await prisma.planRequest.delete({ where: { id: planReq.id } }).catch(() => {})
      return reply.code(500).send({ error: err.message ?? 'Erreur Orange Money' })
    }
  })

  // ── POST /api/payments/wave/webhook ──────────
  // Webhook Wave — active automatiquement le plan après paiement
  app.post('/api/payments/wave/webhook', async (request: any, reply: any) => {
    const signature = request.headers['x-wave-signature'] as string
    const payload   = (request.rawBody ?? JSON.stringify(request.body)) as string

    // Vérifie la signature
    if (!verifyWaveWebhook(payload, signature)) {
      return reply.code(401).send({ error: 'Signature invalide' })
    }

    const event = request.body as any

    if (event.type === 'checkout.session.completed') {
      await activatePlan({
        reference: event.data?.client_reference,
        amount:    event.data?.amount,
        method:    'wave',
      })
    }

    return { received: true }
  })

  // ── POST /api/payments/orange/webhook ────────
  // Webhook Orange Money
  app.post('/api/payments/orange/webhook', async (request: any) => {
    const data = request.body as any

    if (data.status === 'SUCCESS') {
      await activatePlan({
        reference: data.order_id ?? data.txnid,
        amount:    data.amount,
        method:    'orange_money',
      })
    }

    return { received: true }
  })

  // ── GET /api/payments/status/:reference ──────
  // Vérifie le statut d'un paiement
  app.get('/api/payments/status/:reference', {
    preHandler: [authenticate],
  }, async (request: any, reply: any) => {
    const { reference } = request.params as { reference: string }
    const tenantId = request.tenantId as string

    const planReq = await prisma.planRequest.findFirst({
      where: { tenantId, paymentRef: reference },
    })

    if (!planReq) {
      return reply.code(404).send({ error: 'Paiement introuvable' })
    }

    return {
      status:    planReq.status,
      plan:      planReq.plan,
      period:    planReq.period,
      amount:    planReq.amount,
      method:    planReq.paymentMethod,
      activated: planReq.status === 'active',
    }
  })
}

// ── Fonction d'activation du plan ───────────
// Idempotente : ne traite qu'une PlanRequest encore en `pending_payment`,
// donc un webhook rejoué ne réactive rien.
async function activatePlan(opts: {
  reference: string
  amount:    number
  method:    string
}): Promise<void> {
  if (!opts.reference) {
    console.warn('⚠️  activatePlan: référence manquante')
    return
  }

  const planReq = await prisma.planRequest.findFirst({
    where: {
      paymentRef: opts.reference,
      status:     'pending_payment',
    },
    include: {
      tenant: {
        include: {
          users: { where: { role: 'ADMIN' }, take: 1 },
        },
      },
    },
  })

  if (!planReq) {
    console.warn('⚠️  Plan request non trouvé:', opts.reference)
    return
  }

  // Active le plan (partie critique en transaction). On aligne le tenant sur
  // le même état que la validation manuelle par le super-admin (cf. admin.ts) :
  // planActivatedAt + extension de trialEnds, pour que le cron d'expiration
  // n'aille pas suspendre un tenant qui vient de payer.
  await prisma.$transaction([
    prisma.planRequest.update({
      where: { id: planReq.id },
      data:  { status: 'active', adminNotes: 'Auto-activé via webhook', reviewedAt: new Date() },
    }),
    prisma.tenant.update({
      where: { id: planReq.tenantId },
      data: {
        plan:            planReq.plan,
        status:          'active',
        isActive:        true,
        planActivatedAt: new Date(),
        paymentMethod:   opts.method,
        paymentRef:      opts.reference,
        trialEnds:       new Date(Date.now() + (planReq.period === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  // Journal d'audit (non bloquant) — userId est une FK obligatoire vers User,
  // donc on ne logge que si un admin existe réellement.
  const admin = planReq.tenant?.users[0]
  if (admin?.id) {
    await prisma.auditLog.create({
      data: {
        tenantId:    planReq.tenantId,
        userId:      admin.id,
        module:      'billing',
        action:      'PLAN_ACTIVATED',
        description: JSON.stringify({
          plan:   planReq.plan,
          method: opts.method,
          amount: opts.amount,
          ref:    opts.reference,
        }),
      },
    }).catch(() => {})
  }

  // Email de confirmation
  if (admin?.email) {
    await sendUpgradeConfirmation({
      to:        admin.email,
      shopName:  planReq.tenant?.name ?? '',
      ownerName: admin.name ?? '',
      plan:      planReq.plan,
      amount:    planReq.amount,
      method:    opts.method,
      ref:       opts.reference,
    }).catch(() => {})
  }

  console.log('✅ Plan activé automatiquement:', {
    tenant: planReq.tenantId,
    plan:   planReq.plan,
    method: opts.method,
  })
}
