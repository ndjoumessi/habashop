import crypto from 'crypto'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { requestToPay, getPaymentStatus } from '../services/mtnMomo'
import { xofToCurrency } from '../lib/currency'
import { normalizeMsisdn } from '../lib/msisdn'
import { isNotConfigured, notConfiguredBody } from '../lib/payments/providerConfig'

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
    schema: {
      body: z.object({
        amount:      z.coerce.number().positive({ message: 'Montant invalide' }),
        phoneNumber: z.string().trim().min(1, { message: 'Numéro de téléphone requis' }),
        saleId:      z.string().trim().min(1).optional(),
      }),
    },
  }, async (request: any, reply: any) => {
    const { amount, phoneNumber, saleId } = request.body as { amount: number; phoneNumber: string; saleId?: string }

    /**
     * ⚠️ NORMALISATION SERVEUR — elle n'existait PAS ici.
     * `POS.tsx` normalisait côté client et le zod ne vérifiait que `min(1)` : un appel
     * direct à l'API avec « 677 abc » ou un numéro à 3 chiffres partait tel quel chez MTN.
     * Campay, lui, normalisait déjà côté serveur (`campayPayment.ts:64`) — c'était une
     * asymétrie sur un chemin d'ARGENT : la garde du navigateur n'est pas une garde.
     *
     * Politique `international` : le bac à sable MTN utilise des numéros ÉTRANGERS
     * (46733123453 = Suède), donc restreindre au Cameroun tuerait le flux de test.
     * Même politique que le point d'appel client, et c'est vérifié par `msisdnShared.test.ts`.
     */
    const normalizedPhone = normalizeMsisdn(phoneNumber, 'international')
    if (!normalizedPhone) {
      // ⚠️ Le numéro N'EST PAS renvoyé dans le message (PII) — cf. redactPhone.
      return reply.code(400).send({
        error: 'Numéro de téléphone invalide (8 à 15 chiffres attendus)',
        code:  'PHONE_INVALID',
      })
    }

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
        phoneNumber: normalizedPhone,
        externalId,
        note:        `HabaShop ${externalId}`,
      })
      return { referenceId, status: 'PENDING' }
    } catch (err: any) {
      // phoneNumber exclu des logs (PII) — le message d'erreur MTN suffit au diagnostic.
      request.log.error({ err, step: 'requestToPay', amount: mtnAmount, currency }, 'MTN MoMo requestToPay failed')
      if (isNotConfigured(err)) return reply.code(422).send(notConfiguredBody('mtn_momo'))
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
      if (isNotConfigured(err)) return reply.code(422).send(notConfiguredBody('mtn_momo'))
      return reply.code(502).send({ error: 'Erreur MTN MoMo status' })
    }
  })
}
