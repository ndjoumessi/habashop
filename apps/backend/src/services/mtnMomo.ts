import crypto from 'crypto'

const ENV     = process.env.MTN_MOMO_ENVIRONMENT ?? 'sandbox'
const BASE_URL = ENV === 'production'
  ? 'https://proxy.momoapi.mtn.com'
  : 'https://sandbox.momodeveloper.mtn.com'

const SUB_KEY = process.env.MTN_MOMO_SUBSCRIPTION_KEY ?? ''
const USER_ID = process.env.MTN_MOMO_USER_ID ?? ''
const API_KEY = process.env.MTN_MOMO_API_KEY ?? ''

let _token: string | null = null
let _tokenExp = 0

export async function getAccessToken(): Promise<string> {
  if (_token && Date.now() < _tokenExp) return _token
  const creds = Buffer.from(`${USER_ID}:${API_KEY}`).toString('base64')
  const res = await fetch(`${BASE_URL}/collection/token/`, {
    method:  'POST',
    headers: {
      'Authorization':            `Basic ${creds}`,
      'Ocp-Apim-Subscription-Key': SUB_KEY,
    },
  })
  if (!res.ok) throw new Error(`MTN token error: ${res.status}`)
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
      'Ocp-Apim-Subscription-Key': SUB_KEY,
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
    throw new Error(`MTN requestToPay error: ${res.status}${body ? ' — ' + body : ''}`)
  }

  return referenceId
}

export async function getPaymentStatus(
  referenceId: string,
): Promise<'PENDING' | 'SUCCESSFUL' | 'FAILED'> {
  const token = await getAccessToken()

  const res = await fetch(
    `${BASE_URL}/collection/v1_0/requesttopay/${referenceId}`,
    {
      headers: {
        'Authorization':             `Bearer ${token}`,
        'X-Target-Environment':      ENV,
        'Ocp-Apim-Subscription-Key': SUB_KEY,
      },
    },
  )

  if (!res.ok) throw new Error(`MTN status error: ${res.status}`)
  const data = await res.json() as { status: string }
  if (data.status === 'SUCCESSFUL') return 'SUCCESSFUL'
  if (data.status === 'FAILED')     return 'FAILED'
  return 'PENDING'
}
