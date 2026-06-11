import { timingSafeEqual, createHmac } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/authenticate'
import { collect, getStatus } from '../services/campay'
import { prisma } from '../db'

const IS_SANDBOX = (process.env.CAMPAY_ENVIRONMENT ?? 'demo') !== 'production'

// ── Normalisation MSISDN Cameroun ────────────────────────────────────────────
// Formats acceptés :
//   - Déjà préfixé 237XXXXXXXXX (10 chiffres après 237) → retourné tel quel
//   - +237XXXXXXXXX → retire le +
//   - Tout numéro de 9 chiffres commençant par 6 → préfixe 237
// Opérateurs :
//   - Orange CM : 69XXXXXXX, 65[5-9]XXXXXXX
//   - MTN CM    : 67XXXXXXX, 65[0-4]XXXXXXX
// Retourne null si le numéro ne peut pas être normalisé.
export function normalizeCameroonPhone(raw: string): string | null {
  const stripped = raw.trim().replace(/[\s\-().]/g, '')

  // Déjà en format international complet : 237 + 9 chiffres
  if (/^237[0-9]{9}$/.test(stripped)) return stripped

  // Avec le +
  if (/^\+237[0-9]{9}$/.test(stripped)) return stripped.slice(1)

  // 9 chiffres commençant par 6 (numéro local Cameroun)
  if (/^6[0-9]{8}$/.test(stripped)) return `237${stripped}`

  return null
}

export async function campayPaymentRoutes(app: FastifyInstance): Promise<void> {
  // ── POST /api/payments/campay/request ────────────────────────────────
  // Initie un paiement Campay (Orange Money / MTN MoMo / cartes Cameroun).
  // RBAC : CASHIER et au-dessus.
  app.post('/api/payments/campay/request', {
    preHandler: [authenticate],
    config:     { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request: any, reply: any) => {
    const { amount, phoneNumber, operator } = (request.body ?? {}) as {
      amount?:      number
      phoneNumber?: string
      operator?:    'orange' | 'mtn'
    }

    if (!amount || amount <= 0)
      return reply.code(400).send({ error: 'Montant invalide' })
    if (!phoneNumber)
      return reply.code(400).send({ error: 'Numéro de téléphone requis' })

    // XOF → XAF : parité 1:1 (arrondi entier)
    const xafAmount = Math.round(amount)

    const normalizedPhone = normalizeCameroonPhone(phoneNumber)
    if (!normalizedPhone)
      return reply.code(400).send({ error: 'Numéro de téléphone invalide (format Cameroun attendu)' })

    const externalRef = `HABA-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    try {
      const result = await collect({
        amount:      xafAmount,
        phone:       normalizedPhone,
        externalRef,
        description: `HabaShop ${externalRef}`,
      })
      return { reference: result.reference, status: 'PENDING', ussd_code: result.ussd_code ?? null }
    } catch (err: any) {
      // phoneNumber exclu des logs (PII) — le message d'erreur Campay suffit au diagnostic.
      request.log.error({ err, step: 'collect', amount: xafAmount, operator: operator ?? 'unknown' }, 'Campay collect failed')
      return reply.code(502).send({ error: err.message ?? 'Erreur Campay' })
    }
  })

  // ── POST /api/payments/campay/status ─────────────────────────────────
  // Polling statut d'une demande de paiement Campay.
  app.post('/api/payments/campay/status', {
    preHandler: [authenticate],
  }, async (request: any, reply: any) => {
    const { reference } = (request.body ?? {}) as { reference?: string }
    if (!reference)
      return reply.code(400).send({ error: 'reference requis' })

    try {
      const status = await getStatus(reference)
      // Sandbox : Campay ne résout pas toujours PENDING automatiquement — simulation SUCCESSFUL pour les tests.
      // Opt-in EXPLICITE : CAMPAY_SANDBOX_AUTO_SUCCESS=1 requis. Une var absente en prod ne peut PAS
      // auto-approuver un paiement (IS_SANDBOX seul ne suffit pas).
      const sandboxAutoSuccess = process.env.CAMPAY_SANDBOX_AUTO_SUCCESS === '1' && IS_SANDBOX
      if (sandboxAutoSuccess && status === 'PENDING') return { reference, status: 'SUCCESSFUL' }
      return { reference, status }
    } catch (err: any) {
      request.log.error({ err }, 'Campay status failed')
      return reply.code(502).send({ error: 'Erreur Campay status' })
    }
  })

  // ── POST /api/payments/campay/webhook ────────────────────────────────
  // Webhook Campay : notification asynchrone de statut de paiement.
  // Pas d'auth JWT — authentifié via signature HMAC-SHA256.
  // Fail-closed : si CAMPAY_WEBHOOK_KEY absent, toute requête est rejetée (401).
  app.post('/api/payments/campay/webhook', async (request: any, reply: any) => {
    const webhookKey = process.env.CAMPAY_WEBHOOK_KEY

    // Fail-closed : pas de clé = pas de traitement
    if (!webhookKey) {
      request.log.warn('Campay webhook rejeté : CAMPAY_WEBHOOK_KEY non configuré')
      return reply.code(401).send({ error: 'Webhook non configuré' })
    }

    // Vérification signature : x-campay-signature = HMAC-SHA256(rawBody, CAMPAY_WEBHOOK_KEY)
    const signature = (request.headers['x-campay-signature'] ?? '') as string
    if (!signature) {
      return reply.code(401).send({ error: 'Signature manquante' })
    }

    // rawBody : Fastify expose le body brut via request.rawBody si addContentTypeParser est configuré.
    // Fallback : on sérialise le body parsé (même résultat pour du JSON bien formé).
    const rawBody: string = (request.rawBody as string | undefined)
      ?? JSON.stringify(request.body ?? {})

    const expected = createHmac('sha256', webhookKey)
      .update(rawBody)
      .digest('hex')

    let signaturesMatch = false
    try {
      signaturesMatch = timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      )
    } catch {
      // timingSafeEqual lève si les buffers ont des longueurs différentes
      signaturesMatch = false
    }

    if (!signaturesMatch) {
      request.log.warn('Campay webhook : signature invalide')
      return reply.code(401).send({ error: 'Signature invalide' })
    }

    const { reference, status, external_reference } = (request.body ?? {}) as {
      reference?:          string
      status?:             string
      external_reference?: string
    }

    if (!reference || !status) {
      return reply.code(400).send({ error: 'Payload incomplet (reference + status requis)' })
    }

    // Mise à jour de la vente associée (par campayReference OU external_reference)
    try {
      const sale = await prisma.sale.findFirst({
        where: {
          OR: [
            ...(reference          ? [{ campayReference: reference }]          : []),
            ...(external_reference ? [{ campayReference: external_reference }] : []),
            ...(external_reference ? [{ mtnMomoReference: external_reference }]: []),
          ],
        },
        select: { id: true, tenantId: true },
      })

      if (sale) {
        await prisma.sale.update({
          where: { id: sale.id },
          data:  { campayReference: reference },
        })
        request.log.info({ saleId: sale.id, status }, 'Campay webhook : vente mise à jour')
      } else {
        // Vente introuvable = peut-être non encore créée ou external_reference non lié
        request.log.warn({ status, external_reference: external_reference ?? null }, 'Campay webhook : vente non trouvée')
      }
    } catch (err: any) {
      request.log.error({ err }, 'Campay webhook : erreur mise à jour vente')
      // On retourne 200 quand même : évite les retry Campay sur des erreurs DB transitoires
      // (la réconciliation manuelle peut se faire via les logs).
    }

    return { ok: true }
  })
}
