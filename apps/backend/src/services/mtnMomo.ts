import crypto from 'crypto'
import { requireProvider } from '../lib/payments/providerConfig'

const ENV     = process.env.MTN_MOMO_ENVIRONMENT ?? 'sandbox'
const BASE_URL = ENV === 'production'
  ? 'https://proxy.momoapi.mtn.com'
  : 'https://sandbox.momodeveloper.mtn.com'

// ⚠️ Lus À L'APPEL : figés en constantes, ils rendaient les tests process.env inopérants.
const subKey = (): string => process.env.MTN_MOMO_SUBSCRIPTION_KEY ?? ''
const userId = (): string => process.env.MTN_MOMO_USER_ID ?? ''
const apiKey = (): string => process.env.MTN_MOMO_API_KEY ?? ''

let _token: string | null = null
let _tokenExp = 0

export async function getAccessToken(): Promise<string> {
  if (_token && Date.now() < _tokenExp) return _token
  // ⚠️ Refus AVANT le réseau. Sans clés, MTN partait quand même chercher un jeton avec des
  // identifiants vides et remontait « MTN token error: 401 » → 502 côté route : un message
  // de panne pour un défaut de configuration. MTN n'a AUCUN mode simulé (`sandbox_flag:
  // null` au registre) : sans clés, il refuse, point.
  requireProvider('mtn_momo')
  const creds = Buffer.from(`${userId()}:${apiKey()}`).toString('base64')
  const res = await fetch(`${BASE_URL}/collection/token/`, {
    method:  'POST',
    headers: {
      'Authorization':            `Basic ${creds}`,
      'Ocp-Apim-Subscription-Key': subKey(),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[MTN]', { step: 'getAccessToken', status: res.status, body })
    throw new Error(`MTN token error: ${res.status}`)
  }
  const data = await res.json() as { access_token: string; expires_in: number }
  _token    = data.access_token
  _tokenExp = Date.now() + (data.expires_in - 60) * 1000
  return _token
}

// Réinitialise le cache (utile pour les tests).
export function _resetTokenCache() {
  _token    = null
  _tokenExp = 0
}

export async function requestToPay(opts: {
  amount:      number
  currency:    string
  phoneNumber: string  // MSISDN complet, ex: 237677000000
  externalId:  string  // UUID unique par transaction
  note:        string
}): Promise<string> {
  const token       = await getAccessToken()
  const referenceId = crypto.randomUUID()

  const res = await fetch(`${BASE_URL}/collection/v1_0/requesttopay`, {
    method:  'POST',
    headers: {
      'Authorization':             `Bearer ${token}`,
      'X-Reference-Id':            referenceId,
      'X-Target-Environment':      ENV,
      'Ocp-Apim-Subscription-Key': subKey(),
      'Content-Type':              'application/json',
    },
    body: JSON.stringify({
      amount:       String(opts.amount),
      currency:     opts.currency,
      externalId:   opts.externalId,
      payer:        { partyIdType: 'MSISDN', partyId: opts.phoneNumber },
      payerMessage: opts.note,
      payeeNote:    opts.note,
    }),
  })

  // MTN renvoie 202 Accepted (pas 200) pour une demande en cours.
  if (res.status !== 202 && !res.ok) {
    const body = await res.text().catch(() => '')
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => { headers[k] = v })
    console.error('[MTN]', { step: 'requestToPay', status: res.status, body, headers })
    throw new Error(`MTN requestToPay error: ${res.status}${body ? ' — ' + body : ''}`)
  }

  return referenceId
}

export async function getPaymentStatus(
  referenceId: string,
): Promise<'PENDING' | 'SUCCESSFUL' | 'FAILED'> {
  const token = await getAccessToken()
  const url   = `${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`

  const res = await fetch(url, {
    headers: {
      'Authorization':             `Bearer ${token}`,
      'X-Target-Environment':      ENV,
      'Ocp-Apim-Subscription-Key': subKey(),
    },
  })

  const bodyText = await res.text().catch(() => '')
  if (!res.ok) {
    let body: unknown = bodyText
    try { body = JSON.parse(bodyText) } catch { /* garde le texte brut */ }
    // subKey exclu des logs (credential) — env + status + body suffisent au diagnostic.
    console.error('[MTN status]', { referenceId, url, env: ENV, status: res.status, body })
    throw new Error(`MTN status error: ${res.status} — ${bodyText}`)
  }
  const data = JSON.parse(bodyText || '{}') as { status?: string }
  if (data.status === 'SUCCESSFUL') return 'SUCCESSFUL'
  if (data.status === 'FAILED')     return 'FAILED'
  return 'PENDING'
}
