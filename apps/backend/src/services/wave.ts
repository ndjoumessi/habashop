import crypto from 'crypto'

/**
 * Intégration Wave Business API.
 *
 * ⚠️ CHANGEMENT DE COMPORTEMENT (2026-08-06) : sans `WAVE_API_KEY`, ce module NE
 * FABRIQUE PLUS de lien. Il rendait `https://sandbox.wave.com/pay/<ref>` — un artefact
 * parfaitement crédible pour le commerçant, adossé à une `PlanRequest` que rien ne pouvait
 * honorer, puisque le webhook est fail-closed. L'aller ne l'était pas.
 *
 * Trois états désormais, arbitrés par `lib/payments/providerConfig` :
 * clé présente → appel réel · clé absente + `WAVE_SANDBOX_LINKS=1` hors production →
 * artefact simulé assumé · sinon → `PaymentNotConfiguredError` (routes : 422).
 *
 * Docs : https://developer.wave.com
 */
import { requireProvider } from '../lib/payments/providerConfig'

const BASE_URL = 'https://api.wave.com/v1'

// ⚠️ Lu À L'APPEL, jamais figé en constante de module : une constante rendrait
// inopérants les tests qui pilotent `process.env` (convention du dépôt).
const apiKey = (): string => process.env.WAVE_API_KEY ?? ''

// ── Créer un lien de paiement Wave ───────────
export async function createWaveCheckout(opts: {
  amount:      number  // en XOF
  currency:    string  // 'XOF'
  description: string
  reference:   string  // ID unique de la transaction
  redirectUrl: string  // URL après paiement
  webhookUrl:  string  // URL pour les notifications
  clientPhone?: string
}): Promise<{
  checkoutUrl: string
  checkoutId:  string
  status:      string
}> {
  // Lève `PaymentNotConfiguredError` si la clé manque sans opt-in explicite.
  if (requireProvider('wave') === 'simulated') {
    console.warn('⚠️  WAVE_SANDBOX_LINKS=1 — lien SIMULÉ (jamais en production)')
    return {
      checkoutUrl: `https://sandbox.wave.com/pay/${opts.reference}`,
      checkoutId:  `sandbox_${opts.reference}`,
      status:      'pending',
    }
  }

  const res = await fetch(`${BASE_URL}/checkout/sessions`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${apiKey()}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      amount:                  opts.amount,
      currency:                opts.currency,
      error_url:               `${opts.redirectUrl}?status=error&ref=${opts.reference}`,
      success_url:             `${opts.redirectUrl}?status=success&ref=${opts.reference}`,
      webhook_url:             opts.webhookUrl,
      client_reference:        opts.reference,
      restrict_payment_method: 'wave_wallet',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Wave API error: ${res.status} — ${err}`)
  }

  const data = await res.json() as any
  return {
    checkoutUrl: data.wave_launch_url,
    checkoutId:  data.id,
    status:      data.payment_status,
  }
}

// ── Vérifier un paiement Wave ─────────────────
export async function verifyWavePayment(
  checkoutId: string
): Promise<{
  status:    string
  amount:    number
  reference: string
  paid:      boolean
}> {
  // ⚠️ Cette branche renvoyait `paid: true` SANS CLÉ : une confirmation de paiement
  // fabriquée, bien pire qu'un lien mort. Elle exige désormais l'opt-in explicite, et
  // reste impossible en production.
  if (requireProvider('wave') === 'simulated') {
    console.warn('⚠️  WAVE_SANDBOX_LINKS=1 — paiement SIMULÉ réussi (jamais en production)')
    return {
      status:    'succeeded',
      amount:    0,
      reference: checkoutId,
      paid:      true,
    }
  }

  const res = await fetch(
    `${BASE_URL}/checkout/sessions/${checkoutId}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey()}`,
      },
    }
  )

  if (!res.ok) throw new Error(`Wave verify error: ${res.status}`)

  const data = await res.json() as any
  return {
    status:    data.payment_status,
    amount:    data.amount,
    reference: data.client_reference,
    paid:      data.payment_status === 'succeeded',
  }
}

// ── Valider la signature du webhook Wave ──────
// FAIL CLOSED (parité avec verifyOrangeWebhook) : sans `WAVE_WEBHOOK_SECRET`
// configuré OU sans signature → on REJETTE. Aucun chemin n'accepte un webhook
// non signé, même en dev/sandbox : poser `WAVE_WEBHOOK_SECRET` dans l'env.
// HMAC-SHA256 sur le RAW body, comparaison timing-safe.
export function verifyWaveWebhook(payload: string, signature?: string): boolean {
  const secret = process.env.WAVE_WEBHOOK_SECRET
  if (!secret) return false      // fail closed : pas de secret → on rejette
  if (!signature) return false

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  // timingSafeEqual exige des buffers de même longueur
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}
