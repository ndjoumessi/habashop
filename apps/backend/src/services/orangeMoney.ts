/**
 * Intégration Orange Money Web Payment API.
 * En l'absence de ORANGE_CLIENT_ID / ORANGE_CLIENT_SECRET, toutes les
 * fonctions basculent en mode sandbox (liens simulés, paiements réussis)
 * — prêt pour la prod dès que les clés sont fournies.
 * Docs : https://developer.orange.com
 */

const OM_CLIENT_ID     = process.env.ORANGE_CLIENT_ID
const OM_CLIENT_SECRET = process.env.ORANGE_CLIENT_SECRET
const OM_BASE_URL      = 'https://api.orange.com/orange-money-webpay/dev/v1'

let omToken: { value: string; expiresAt: number } | null = null

// ── Obtenir un token OAuth2 ───────────────────
async function getOMToken(): Promise<string> {
  if (omToken && omToken.expiresAt > Date.now() + 60000) {
    return omToken.value
  }

  if (!OM_CLIENT_ID || !OM_CLIENT_SECRET) {
    console.warn('⚠️  ORANGE_CLIENT_ID manquant — mode sandbox')
    return 'sandbox_token'
  }

  const credentials = Buffer.from(
    `${OM_CLIENT_ID}:${OM_CLIENT_SECRET}`
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
  if (!OM_CLIENT_ID) {
    console.warn('⚠️  ORANGE_CLIENT_ID manquant — mode sandbox')
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
        merchant_key: OM_CLIENT_ID,
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
  if (!OM_CLIENT_ID) {
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
        merchant_key: OM_CLIENT_ID,
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
