import { appUrl } from '../lib/appUrl'

const ENV      = process.env.CAMPAY_ENVIRONMENT ?? 'demo'
const BASE_URL = ENV === 'production' ? 'https://campay.net' : 'https://demo.campay.net'

// Token cache (55 min — le jeton Campay dure 60 min, on renouvelle 5 min avant)
let _token: string | null = null
let _tokenExp = 0

export async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExp) return _token

  const username = process.env.CAMPAY_USERNAME
  const password = process.env.CAMPAY_PASSWORD

  if (username && password) {
    try {
      const res = await fetch(`${BASE_URL}/api/token/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      })
      if (res.ok) {
        const data = await res.json() as { token: string; expires_in?: number }
        _token    = data.token
        // expires_in en secondes ; 55 min si non fourni
        _tokenExp = Date.now() + ((data.expires_in ?? 3600) - 300) * 1000
        return _token
      }
      // Échec credentials → essai fallback ci-dessous
      const errText = await res.text().catch(() => '')
      console.error('[Campay] token via credentials échoué', { status: res.status, body: errText })
    } catch (err) {
      console.error('[Campay] fetch token error', err)
    }
  }

  // Fallback : jeton permanent (CAMPAY_TOKEN)
  const staticToken = process.env.CAMPAY_TOKEN
  if (staticToken) {
    _token    = staticToken
    _tokenExp = Date.now() + 55 * 60 * 1000 // traitez-le comme 55 min aussi
    return _token
  }

  throw new Error('Campay: impossible d\'obtenir un jeton (CAMPAY_USERNAME/CAMPAY_PASSWORD ou CAMPAY_TOKEN requis)')
}

// Réinitialise le cache (utile pour les tests).
export function _resetTokenCache(): void {
  _token    = null
  _tokenExp = 0
}

export async function collect(opts: {
  amount:      number   // entier XAF
  phone:       string   // MSISDN 237XXXXXXXXX
  externalRef: string
  description: string
}): Promise<{ reference: string; operator_tx_id?: string; ussd_code?: string }> {
  const token = await getToken()

  const res = await fetch(`${BASE_URL}/api/collect/`, {
    method:  'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      amount:             opts.amount,
      currency:           'XAF',
      from:               opts.phone,
      description:        opts.description,
      external_reference: opts.externalRef,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // Ne pas logger le numéro de téléphone (PII)
    console.error('[Campay] collect error', { status: res.status, body, externalRef: opts.externalRef })
    throw new Error(`Campay collect error: ${res.status}${body ? ' — ' + body : ''}`)
  }

  const data = await res.json() as {
    reference:       string
    operator_tx_id?: string
    ussd_code?:      string
  }
  return {
    reference:       data.reference,
    operator_tx_id:  data.operator_tx_id,
    ussd_code:       data.ussd_code,
  }
}

export async function getStatus(reference: string): Promise<'PENDING' | 'SUCCESSFUL' | 'FAILED'> {
  const token = await getToken()

  const res = await fetch(`${BASE_URL}/api/transaction/${reference}/`, {
    headers: {
      'Authorization': `Token ${token}`,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[Campay] getStatus error', { status: res.status, body })
    throw new Error(`Campay getStatus error: ${res.status}${body ? ' — ' + body : ''}`)
  }

  const data = await res.json() as { status?: string }
  if (data.status === 'SUCCESSFUL') return 'SUCCESSFUL'
  if (data.status === 'FAILED')     return 'FAILED'
  return 'PENDING'
}

export async function getPaymentLink(opts: {
  amount:             number   // entier XAF
  externalRef:        string
  description:        string
  redirectUrl?:       string
  failureRedirectUrl?: string
  from?:              string   // MSISDN client (optionnel en mode carte)
  firstName?:         string
  lastName?:          string
  paymentOptions?:    string   // "CARD" | "MOMO" | "MOMO,CARD"
}): Promise<{ link: string; reference: string }> {
  const token = await getToken()

  const res = await fetch(`${BASE_URL}/api/get_payment_link/`, {
    method:  'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      amount:               opts.amount,
      currency:             'XAF',
      description:          opts.description,
      external_reference:   opts.externalRef,
      from:                 opts.from              ?? '',
      first_name:           opts.firstName         ?? 'Client',
      last_name:            opts.lastName          ?? '',
      email:                '',
      redirect_url:         opts.redirectUrl        ?? appUrl('/app/pos'),
      failure_redirect_url: opts.failureRedirectUrl ?? appUrl('/app/pos'),
      payment_options:      opts.paymentOptions    ?? 'CARD',
    }),
  })

  const bodyText = await res.text().catch(() => '')

  if (!res.ok) {
    console.error('[Campay] getPaymentLink error', { status: res.status, body: bodyText })
    throw new Error(`Campay getPaymentLink error: ${res.status}${bodyText ? ' — ' + bodyText : ''}`)
  }

  // Log brut pour diagnostiquer la structure exacte retournée (champs, JWT éventuel, etc.)
  console.log('[Campay] getPaymentLink response', { status: res.status, body: bodyText })

  let data: Record<string, unknown>
  try { data = JSON.parse(bodyText) } catch {
    throw new Error(`Campay getPaymentLink: réponse non-JSON — ${bodyText.slice(0, 200)}`)
  }

  if (!data.link || !data.reference) {
    throw new Error(`Campay getPaymentLink: champs link/reference manquants — ${JSON.stringify(data)}`)
  }
  return { link: data.link as string, reference: data.reference as string }
}
