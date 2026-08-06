/**
 * Intégration Orange Money Web Payment API.
 *
 * ⚠️ CHANGEMENT DE COMPORTEMENT (2026-08-06), identique à `wave.ts` : sans
 * `ORANGE_CLIENT_ID` / `ORANGE_CLIENT_SECRET`, ce module NE FABRIQUE PLUS ni lien
 * (`https://sandbox.orangemoney.com/pay/<ref>`) ni confirmation `paid: true`. Le refus
 * passe par `PaymentNotConfiguredError` → 422 côté route. L'artefact simulé exige
 * `ORANGE_SANDBOX_LINKS=1` et reste impossible en production.
 * Docs : https://developer.orange.com
 */

import crypto from 'crypto'

import { requireProvider } from '../lib/payments/providerConfig'

// ⚠️ Lus À L'APPEL (cf. wave.ts) : des constantes de module rendraient inopérants les
// tests qui pilotent `process.env`.
const clientId     = (): string => process.env.ORANGE_CLIENT_ID ?? ''
const clientSecret = (): string => process.env.ORANGE_CLIENT_SECRET ?? ''
const OM_BASE_URL  = 'https://api.orange.com/orange-money-webpay/dev/v1'

/**
 * Vérifie l'authenticité d'un webhook Orange Money — HMAC-SHA256 du RAW body
 * avec `ORANGE_MONEY_WEBHOOK_SECRET`, comparaison timing-safe (calqué sur Wave).
 *
 * ⚠️ FAIL CLOSED (différence volontaire avec `verifyWaveWebhook` qui fail-open en
 * sandbox) : sans secret configuré OU sans signature → rejet. Un webhook Orange
 * ne peut donc JAMAIS activer un plan sur une requête forgée non signée.
 * Secret lu à l'appel (et non au chargement du module) pour robustesse env.
 */
export function verifyOrangeWebhook(payload: string, signature?: string): boolean {
  const secret = process.env.ORANGE_MONEY_WEBHOOK_SECRET
  if (!secret) return false      // fail closed : pas de secret → on rejette
  if (!signature) return false
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length) return false
  return crypto.timingSafeEqual(sigBuf, expBuf)
}

let omToken: { value: string; expiresAt: number } | null = null

// ── Obtenir un token OAuth2 ───────────────────
async function getOMToken(): Promise<string> {
  if (omToken && omToken.expiresAt > Date.now() + 60000) {
    return omToken.value
  }

  if (requireProvider('orange_money') === 'simulated') {
    console.warn('⚠️  ORANGE_SANDBOX_LINKS=1 — jeton SIMULÉ (jamais en production)')
    return 'sandbox_token'
  }

  const credentials = Buffer.from(
    `${clientId()}:${clientSecret()}`
  ).toString('base64')

  const res = await fetch(
    'https://api.orange.com/oauth/v3/token',
    {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/x-www-form-urlencoded',
        'Accept':        'application/json',
      },
      body: 'grant_type=client_credentials',
    }
  )

  if (!res.ok) throw new Error(`OM auth error: ${res.status}`)

  const data = await res.json() as any
  omToken = {
    value:     data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  }
  return omToken.value
}

// ── Initier un paiement Orange Money ─────────
export async function createOMPayment(opts: {
  amount:      number   // en XOF
  reference:   string
  description: string
  notifUrl:    string   // webhook URL
  returnUrl:   string   // redirect après paiement
  cancelUrl:   string
  currency?:   string   // XOF par défaut
  lang?:       string   // fr par défaut
}): Promise<{
  paymentUrl: string
  payToken:   string
  status:     string
}> {
  if (requireProvider('orange_money') === 'simulated') {
    console.warn('⚠️  ORANGE_SANDBOX_LINKS=1 — lien SIMULÉ (jamais en production)')
    return {
      paymentUrl: `https://sandbox.orangemoney.com/pay/${opts.reference}`,
      payToken:   `sandbox_${opts.reference}`,
      status:     'INITIATED',
    }
  }

  const token = await getOMToken()

  const res = await fetch(
    `${OM_BASE_URL}/webpayment`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify({
        merchant_key: clientId(),
        currency:     opts.currency ?? 'OUV',
        order_id:     opts.reference,
        amount:       opts.amount,
        return_url:   opts.returnUrl,
        cancel_url:   opts.cancelUrl,
        notif_url:    opts.notifUrl,
        lang:         opts.lang ?? 'fr',
        reference:    opts.description,
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Orange Money error: ${res.status} — ${err}`)
  }

  const data = await res.json() as any
  return {
    paymentUrl: data.payment_url,
    payToken:   data.pay_token,
    status:     data.status,
  }
}

// ── Vérifier un paiement OM ───────────────────
export async function verifyOMPayment(
  orderRef: string
): Promise<{
  status: string
  amount: number
  paid:   boolean
}> {
  // ⚠️ Renvoyait `paid: true` SANS CLÉ — une confirmation de paiement fabriquée.
  if (requireProvider('orange_money') === 'simulated') {
    console.warn('⚠️  ORANGE_SANDBOX_LINKS=1 — paiement SIMULÉ réussi (jamais en production)')
    return { status: 'SUCCESS', amount: 0, paid: true }
  }

  const token = await getOMToken()

  const res = await fetch(
    `${OM_BASE_URL}/transactionstatus`,
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        order_id:     orderRef,
        merchant_key: clientId(),
      }),
    }
  )

  if (!res.ok) throw new Error(`OM verify error: ${res.status}`)

  const data = await res.json() as any
  return {
    status: data.status,
    amount: data.amount,
    paid:   data.status === 'SUCCESS',
  }
}
