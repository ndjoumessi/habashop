import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { prisma } from '../db'
import {
  IS_TEST, paydunyaConfigured, createInvoice, confirmInvoice, verifyIpnHash, normalizeStatus,
} from '../services/paydunya'

const FRONT_URL = process.env.FRONTEND_URL ?? 'https://habashop.vercel.app'
const PAYDUNYA_METHODS = ['Wave', 'Orange Money', 'Free Money', 'Expresso', 'Djamo', 'Visa/MC']

export async function paydunyaPaymentRoutes(app: FastifyInstance): Promise<void> {
  // ── GET /api/payments/paydunya/config ───────────────────────────────────────
  // État de configuration (consommé par la page Intégrations + le POS pour décider d'afficher PayDunya).
  app.get('/api/payments/paydunya/config', { preHandler: [authenticate] }, async () => {
    return {
      configured: paydunyaConfigured(),
      mode:       IS_TEST ? 'test' : 'live',
      methods:    PAYDUNYA_METHODS,
    }
  })

  // ── POST /api/payments/paydunya/initiate ─────────────────────────────────────
  // Crée une facture PayDunya → renvoie token + URL hébergée (QR / redirection). CASHIER+.
  app.post('/api/payments/paydunya/initiate', {
    preHandler: [authenticate],
    config:     { rateLimit: { max: 20, timeWindow: '1 minute' } },
    schema: {
      body: z.object({
        amount:      z.coerce.number().positive({ message: 'Montant invalide' }),
        description: z.string().trim().max(500).optional(),
      }),
    },
  }, async (request: any, reply: any) => {
    if (!paydunyaConfigured())
      return reply.code(503).send({ error: 'PayDunya non configuré', code: 'PAYDUNYA_NOT_CONFIGURED' })

    const { amount, description } = request.body as { amount: number; description?: string }

    const tenantId = request.user?.tenantId ?? request.tenantId
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
    const externalRef = `HABA-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    try {
      const { token, url } = await createInvoice({
        amount:      Math.round(amount),                  // XOF natif (UEMOA) — pas de conversion
        description: description || `HabaShop ${externalRef}`,
        storeName:   tenant?.name || 'HabaShop',
        cancelUrl:   `${FRONT_URL}/app/pos`,
        returnUrl:   `${FRONT_URL}/app/pos`,
        callbackUrl: `${FRONT_URL.replace(/\/$/, '')}/api/payments/paydunya/ipn`, // remplacé par l'IPN backend
        customData:  { tenantId, externalRef },
      })
      return { token, redirectUrl: url }
    } catch (err: any) {
      request.log.error({ err, step: 'createInvoice', amount }, 'PayDunya initiate failed')
      return reply.code(502).send({ error: err.message ?? 'Erreur PayDunya' })
    }
  })

  // ── Statut d'une facture par token (polling). CASHIER+. ──────────────────────
  // Deux formes acceptées : POST /status {token} et GET /status/:token (parité front).
  async function statusHandler(token: string | undefined, request: any, reply: any) {
    if (!token) return reply.code(400).send({ error: 'token requis' })

    // Auto-success sandbox EXPLICITE (jamais en live, jamais sans le flag) — parité MTN/Campay.
    const sandboxAutoSuccess = process.env.PAYDUNYA_SANDBOX_AUTO_SUCCESS === '1' && IS_TEST

    try {
      const { status } = await confirmInvoice(token)
      if (sandboxAutoSuccess && status === 'pending') return { status: 'completed' }
      return { status }
    } catch (err: any) {
      request.log.error({ err, step: 'confirmInvoice' }, 'PayDunya status failed')
      return reply.code(502).send({ error: 'Erreur PayDunya status' })
    }
  }

  app.post('/api/payments/paydunya/status', { preHandler: [authenticate] }, async (request: any, reply: any) =>
    statusHandler((request.body ?? {}).token, request, reply))

  app.get('/api/payments/paydunya/status/:token', { preHandler: [authenticate] }, async (request: any, reply: any) =>
    statusHandler(request.params?.token, request, reply))

  // ── POST /api/payments/paydunya/ipn ──────────────────────────────────────────
  // Webhook IPN PayDunya (public, pas de JWT). Authentifié via hash = SHA-512(MASTER_KEY).
  // Fail-closed : MASTER_KEY absente ou hash invalide → 401. RÉCONCILIATION uniquement
  // (la vente est créée par le front au polling completed → POST /api/sales). Renvoie 200 vite.
  // Exempté du rate-limit global : IPN provider (bursts/retries légitimes), authentifié par signature.
  app.post('/api/payments/paydunya/ipn', { config: { rateLimit: false } }, async (request: any, reply: any) => {
    // Le parser urlencoded (server.ts) expose les champs à plat : data[hash], data[status], …
    const form = (request.body?._form ?? request.body ?? {}) as Record<string, any>
    const receivedHash = form['data[hash]'] ?? form?.data?.hash ?? form.hash
    const status       = normalizeStatus(form['data[status]'] ?? form?.data?.status ?? form.status)
    const token        = form['data[invoice][token]'] ?? form?.data?.invoice?.token ?? form.token

    if (!verifyIpnHash(receivedHash)) {
      request.log.warn('PayDunya IPN : hash invalide ou MASTER_KEY absente')
      return reply.code(401).send({ error: 'Hash invalide' })
    }

    // Réconciliation best-effort : associe le token à la vente correspondante si déjà créée.
    if (token) {
      try {
        const sale = await prisma.sale.findFirst({ where: { paydunyaReference: token }, select: { id: true } })
        if (sale) {
          request.log.info({ saleId: sale.id, status }, 'PayDunya IPN : vente reconnue')
        } else {
          request.log.warn({ status }, 'PayDunya IPN : vente non trouvée (token non encore lié)')
        }
      } catch (err: any) {
        request.log.error({ err }, 'PayDunya IPN : erreur lookup vente')
        // 200 quand même → évite les rejeux PayDunya sur erreurs DB transitoires.
      }
    }

    return { ok: true }
  })
}
