import crypto from 'crypto'
import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { requestToPay, getPaymentStatus } from '../services/mtnMomo'

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

    try {
      const referenceId = await requestToPay({
        amount:      Math.round(amount),
        currency:    'XAF',
        phoneNumber,
        externalId,
        note:        `HabaShop ${externalId}`,
      })
      return { referenceId, status: 'PENDING' }
    } catch (err: any) {
      request.log.error({ err }, 'MTN MoMo requestToPay failed')
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
      return { referenceId, status }
    } catch (err: any) {
      request.log.error({ err }, 'MTN MoMo status failed')
      return reply.code(502).send({ error: 'Erreur MTN MoMo status' })
    }
  })
}
