import crypto from 'crypto'
import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { requestToPay, getPaymentStatus } from '../services/mtnMomo'
import { xofToCurrency } from '../lib/currency'

// Sandbox MTN accepte EUR uniquement ; prod Cameroun = XAF (parité 1:1 avec XOF).
const IS_SANDBOX = (process.env.MTN_MOMO_ENVIRONMENT ?? 'sandbox') === 'sandbox'

export async function mtnPaymentRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/payments/mtn/request ───────────────────────────────
  // Initie un paiement MTN MoMo (USSD push vers le client).
  // RBAC : CASHIER et au-dessus. Fail-silent sur erreur réseau MTN
  // (le frontend gère le fallback).
  app.post('/api/payments/mtn/request', {
    preHandler: [authenticate],
    config:     { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request: any, reply: any) => {
    const { amount, phoneNumber, saleId } = (request.body ?? {}) as {
      amount?:      number
      phoneNumber?: string
      saleId?:      string
    }

    if (!amount || amount <= 0)
      return reply.code(400).send({ error: 'Montant invalide' })
    if (!phoneNumber)
      return reply.code(400).send({ error: 'Numéro de téléphone requis' })

    const externalId = saleId ?? crypto.randomUUID()

    // Sandbox MTN : devise EUR uniquement (min 1 €).
    // Production Cameroun : XAF = XOF (parité 1:1).
    const currency  = IS_SANDBOX ? 'EUR' : 'XAF'
    const mtnAmount = IS_SANDBOX
      ? Math.max(1, xofToCurrency(Math.round(amount), 'EUR'))
      : Math.round(amount)

    try {
      const referenceId = await requestToPay({
        amount:      mtnAmount,
        currency,
        phoneNumber,
        externalId,
        note:        `HabaShop ${externalId}`,
      })
      return { referenceId, status: 'PENDING' }
    } catch (err: any) {
      // phoneNumber exclu des logs (PII) — le message d'erreur MTN suffit au diagnostic.
      request.log.error({ err, step: 'requestToPay', amount: mtnAmount, currency }, 'MTN MoMo requestToPay failed')
      return reply.code(502).send({ error: err.message ?? 'Erreur MTN MoMo' })
    }
  })

  // ── POST /api/payments/mtn/status ────────────────────────────────
  // Polling statut d'une demande de paiement MTN MoMo.
  app.post('/api/payments/mtn/status', {
    preHandler: [authenticate],
  }, async (request: any, reply: any) => {
    const { referenceId } = (request.body ?? {}) as { referenceId?: string }
    if (!referenceId)
      return reply.code(400).send({ error: 'referenceId requis' })

    try {
      const status = await getPaymentStatus(referenceId)
      // Sandbox : MTN ne résout jamais PENDING automatiquement — simulation SUCCESSFUL pour les tests.
      // Opt-in EXPLICITE : MTN_SANDBOX_AUTO_SUCCESS=1 requis. Une var absente en prod ne peut PAS
      // auto-approuver un paiement (IS_SANDBOX seul ne suffit pas).
      const sandboxAutoSuccess = process.env.MTN_SANDBOX_AUTO_SUCCESS === '1' && IS_SANDBOX
      if (sandboxAutoSuccess && status === 'PENDING') return { referenceId, status: 'SUCCESSFUL' }
      return { referenceId, status }
    } catch (err: any) {
      request.log.error({ err }, 'MTN MoMo status failed')
      return reply.code(502).send({ error: 'Erreur MTN MoMo status' })
    }
  })
}
