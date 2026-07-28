import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { writeAudit } from '../lib/writeAudit'
import { invalidateTenantSpendInfo } from '../lib/spend/spendGuard'
import { authenticate } from '../middleware/authenticate'
import {
  createWaveCheckout,
  verifyWaveWebhook,
} from '../services/wave'
import {
  createOMPayment,
  verifyOrangeWebhook,
} from '../services/orangeMoney'
import { sendUpgradeConfirmation } from '../services/email'
import { appBaseUrl } from '../lib/appUrl'

// Lecture unique via `lib/appUrl` (adossée à FRONTEND_URL) — plus de repli local dupliqué.
const FRONTEND_URL = appBaseUrl()
const BACKEND_URL = process.env.BACKEND_URL
  ?? 'https://habashop-production.up.railway.app'

const PRICES: Record<string, Record<string, number>> = {
  pro:        { monthly: 24900, yearly: 249000 },
  enterprise: { monthly: 49900, yearly: 499000 },
}

// Body des checkouts d'abonnement (Wave & Orange). La validation sémantique fine
// (couple plan/period existant dans PRICES) reste dans le handler → 400 « Plan invalide ».
const CHECKOUT_BODY = z.object({
  plan:   z.string().trim().min(1),
  period: z.string().trim().min(1),
})

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
/**
 * Décision pure (testable) de traitement d'un webhook Orange Money.
 * Fail CLOSED : tout échec d'authenticité / de validation ⇒ activate=false.
 * On ne fait JAMAIS confiance au payload tant que `signatureValid` n'est pas vrai,
 * et le montant/devise/statut sont validés contre le record en attente.
 * Codes : 2xx = acquitté · 4xx = rejet définitif · (5xx géré côté handler = retry).
 */
export function decideOrangeWebhook(input: {
  signatureValid: boolean
  reference?: string
  planReq: { status: string; amount: number; currency: string } | null
  amount: number       // montant fourni par le payload (authentifié via signature)
  currency: string
  status: string
}): { code: number; activate: boolean; reason: string } {
  if (!input.signatureValid)                          return { code: 401, activate: false, reason: 'invalid_signature' }
  if (!input.reference)                               return { code: 400, activate: false, reason: 'missing_reference' }
  if (!input.planReq)                                 return { code: 404, activate: false, reason: 'unknown_reference' }
  if (input.planReq.status !== 'pending_payment')     return { code: 200, activate: false, reason: 'already_processed' } // idempotence
  if (!Number.isFinite(input.amount) || input.amount !== input.planReq.amount)
                                                      return { code: 403, activate: false, reason: 'amount_mismatch' }
  if (input.currency !== input.planReq.currency)      return { code: 403, activate: false, reason: 'currency_mismatch' }
  if (input.status !== 'SUCCESS')                     return { code: 200, activate: false, reason: 'not_success' }
  return { code: 200, activate: true, reason: 'ok' }
}

/**
 * Décision pure (testable) de traitement d'un webhook Wave — MIROIR EXACT
 * d'Orange (mêmes codes/raisons/idempotence). Fail CLOSED : le payload n'est
 * jamais cru tant que `signatureValid` n'est pas vrai, et montant/devise/statut
 * sont validés CONTRE le record en attente. `status` est dérivé par le handler
 * du type d'événement Wave (`checkout.session.completed` ⇒ 'SUCCESS').
 */
export function decideWaveWebhook(input: {
  signatureValid: boolean
  reference?: string
  planReq: { status: string; amount: number; currency: string } | null
  amount: number       // montant fourni par le payload (authentifié via signature)
  currency: string
  status: string
}): { code: number; activate: boolean; reason: string } {
  if (!input.signatureValid)                          return { code: 401, activate: false, reason: 'invalid_signature' }
  if (!input.reference)                               return { code: 400, activate: false, reason: 'missing_reference' }
  if (!input.planReq)                                 return { code: 404, activate: false, reason: 'unknown_reference' }
  if (input.planReq.status !== 'pending_payment')     return { code: 200, activate: false, reason: 'already_processed' } // idempotence
  if (!Number.isFinite(input.amount) || input.amount !== input.planReq.amount)
                                                      return { code: 403, activate: false, reason: 'amount_mismatch' }
  if (input.currency !== input.planReq.currency)      return { code: 403, activate: false, reason: 'currency_mismatch' }
  if (input.status !== 'SUCCESS')                     return { code: 200, activate: false, reason: 'not_success' }
  return { code: 200, activate: true, reason: 'ok' }
}

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
    schema: { body: CHECKOUT_BODY },
  }, async (request: any, reply: any) => {
    const { plan, period } = request.body as { plan?: string; period?: string }
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
    schema: { body: CHECKOUT_BODY },
  }, async (request: any, reply: any) => {
    const { plan, period } = request.body as { plan?: string; period?: string }
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
  // Webhook Wave — SÉCURISÉ (fail closed, parité EXACTE avec Orange).
  // 1) Signature HMAC obligatoire (sinon rejet, aucune requête DB).
  // 2) Validation montant/devise/référence CONTRE le record en attente.
  // 3) Idempotence (un rejeu n'active pas deux fois). Le payload n'est jamais
  //    cru tant que la signature n'est pas valide ; l'activation lit le RECORD.
  // Exempté du rate-limit global : webhook provider (bursts/retries légitimes), authentifié par HMAC.
  app.post('/api/payments/wave/webhook', { config: { rateLimit: false } }, async (request: any, reply: any) => {
    const event     = (request.body ?? {}) as any
    const rawBody   = (request.rawBody ?? JSON.stringify(event)) as string
    const signature = request.headers['x-wave-signature'] as string | undefined
    const reference = event.data?.client_reference as string | undefined

    const signatureValid = verifyWaveWebhook(rawBody, signature)

    // Aucune requête DB tant que la requête n'est pas authentifiée.
    const planReq = signatureValid && reference
      ? await prisma.planRequest.findFirst({ where: { paymentRef: reference, paymentMethod: 'wave' } })
      : null

    const decision = decideWaveWebhook({
      signatureValid,
      reference,
      planReq:  planReq ? { status: planReq.status, amount: planReq.amount, currency: planReq.currency } : null,
      amount:   Number(event.data?.amount),
      currency: (event.data?.currency ?? 'XOF') as string,
      // Wave : seul `checkout.session.completed` vaut un paiement réussi.
      status:   event.type === 'checkout.session.completed' ? 'SUCCESS' : 'OTHER',
    })

    if (!decision.activate) {
      if (decision.code >= 400) {
        request.log.warn({ reference, reason: decision.reason }, 'wave webhook rejeté') // jamais le secret
      }
      return reply.code(decision.code).send({ received: decision.code < 400, reason: decision.reason })
    }

    // Activation à partir des données du RECORD (jamais du payload) → tenant sûr.
    // activatePlan reste idempotent (ne traite que les PlanRequest `pending_payment`).
    await activatePlan({ reference: planReq!.paymentRef!, amount: planReq!.amount, method: 'wave' })
    return reply.code(200).send({ received: true, activated: true })
  })

  // ── POST /api/payments/orange/webhook ────────
  // Webhook Orange Money — SÉCURISÉ (fail closed, miroir du pattern Wave).
  // 1) Signature HMAC obligatoire (sinon rejet, aucune requête DB).
  // 2) Validation montant/devise/référence CONTRE le record en attente.
  // 3) Idempotence (un rejeu n'active pas deux fois). Le payload n'est jamais
  //    cru tant que la signature n'est pas valide.
  // Exempté du rate-limit global : webhook provider (bursts/retries légitimes), authentifié par HMAC.
  app.post('/api/payments/orange/webhook', { config: { rateLimit: false } }, async (request: any, reply: any) => {
    const data      = (request.body ?? {}) as any
    const rawBody   = (request.rawBody ?? JSON.stringify(data)) as string
    const signature = request.headers['x-orange-signature'] as string | undefined
    const reference = (data.order_id ?? data.txnid) as string | undefined

    const signatureValid = verifyOrangeWebhook(rawBody, signature)

    // Aucune requête DB tant que la requête n'est pas authentifiée.
    const planReq = signatureValid && reference
      ? await prisma.planRequest.findFirst({ where: { paymentRef: reference, paymentMethod: 'orange_money' } })
      : null

    const decision = decideOrangeWebhook({
      signatureValid,
      reference,
      planReq:  planReq ? { status: planReq.status, amount: planReq.amount, currency: planReq.currency } : null,
      amount:   Number(data.amount),
      currency: (data.currency ?? 'XOF') as string,
      status:   data.status as string,
    })

    if (!decision.activate) {
      if (decision.code >= 400) {
        request.log.warn({ reference, reason: decision.reason }, 'orange webhook rejeté') // jamais le secret
      }
      return reply.code(decision.code).send({ received: decision.code < 400, reason: decision.reason })
    }

    // Activation à partir des données du RECORD (jamais du payload) → tenant sûr.
    // activatePlan reste idempotent (ne traite que les PlanRequest `pending_payment`).
    await activatePlan({ reference: planReq!.paymentRef!, amount: planReq!.amount, method: 'orange_money' })
    return reply.code(200).send({ received: true, activated: true })
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
  // Activation par webhook → relecture immédiate du statut par le garde de dépense.
  await invalidateTenantSpendInfo([planReq.tenantId])

  // Journal d'audit (non bloquant) — userId est une FK obligatoire vers User,
  // donc on ne logge que si un admin existe réellement.
  const admin = planReq.tenant?.users[0]
  if (admin?.id) {
    await writeAudit('PLAN_ACTIVATED', prisma.auditLog.create({
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
    }))
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
