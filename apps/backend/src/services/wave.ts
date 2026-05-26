import crypto from 'crypto'

/**
 * Intégration Wave Business API.
 * En l'absence de WAVE_API_KEY, toutes les fonctions basculent en mode
 * sandbox (liens simulés, paiements considérés réussis) — prêt pour la prod
 * dès que les clés sont fournies via les variables d'environnement.
 * Docs : https://developer.wave.com
 */

const WAVE_API_KEY = process.env.WAVE_API_KEY
const WAVE_SECRET  = process.env.WAVE_WEBHOOK_SECRET
const BASE_URL     = 'https://api.wave.com/v1'

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
  if (!WAVE_API_KEY) {
    // Mode sandbox — retourne un lien simulé
    console.warn('⚠️  WAVE_API_KEY manquant — mode sandbox')
    return {
      checkoutUrl: `https://sandbox.wave.com/pay/${opts.reference}`,
      checkoutId:  `sandbox_${opts.reference}`,
      status:      'pending',
    }
  }

  const res = await fetch(`${BASE_URL}/checkout/sessions`, {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${WAVE_API_KEY}`,
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
  if (!WAVE_API_KEY) {
    // Sandbox
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
        'Authorization': `Bearer ${WAVE_API_KEY}`,
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
export function verifyWaveWebhook(
  payload:   string,
  signature: string
): boolean {
  if (!WAVE_SECRET) return true // sandbox
  if (!signature) return false

  const expected = crypto
    .createHmac('sha256', WAVE_SECRET)
    .update(payload)
    .digest('hex')

  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  // timingSafeEqual exige des buffers de même longueur
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}
