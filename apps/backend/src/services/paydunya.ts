import { createHash, timingSafeEqual } from 'crypto'

// PayDunya (Sénégal & UEMOA) — Wave SN, Orange Money SN, Free Money, Expresso, Djamo, Visa/MC.
// Pas de SDK npm : fetch natif (cohérent avec services/campay.ts & mtnMomo.ts).
// Mode : PAYDUNYA_MODE=test → sandbox-api ; sinon (live) → api.
import { requireProvider, missingSecrets } from '../lib/payments/providerConfig'

const MODE     = process.env.PAYDUNYA_MODE ?? 'test'
export const IS_TEST = MODE !== 'live'
const BASE     = IS_TEST
  ? 'https://app.paydunya.com/sandbox-api/v1'
  : 'https://app.paydunya.com/api/v1'

/**
 * Les clés requises sont-elles présentes ?
 * ⚠️ Délègue au registre `lib/payments/providerConfig` : c'était la SEULE définition
 * correcte des cinq (PayDunya refusait déjà proprement en 503), et elle vivait ici, hors
 * de portée des quatre autres. Désormais une seule liste, consommée par tous.
 */
export function paydunyaConfigured(): boolean {
  return missingSecrets('paydunya').length === 0
}

function headers(): Record<string, string> {
  return {
    'Content-Type':        'application/json',
    'PAYDUNYA-MASTER-KEY': process.env.PAYDUNYA_MASTER_KEY  ?? '',
    'PAYDUNYA-PRIVATE-KEY':process.env.PAYDUNYA_PRIVATE_KEY ?? '',
    'PAYDUNYA-TOKEN':      process.env.PAYDUNYA_TOKEN        ?? '',
  }
}

/** Normalise le statut PayDunya vers un jeu fermé. */
export function normalizeStatus(raw?: string): 'completed' | 'cancelled' | 'pending' | 'failed' {
  const s = (raw ?? '').toLowerCase()
  if (s === 'completed') return 'completed'
  if (s === 'cancelled' || s === 'canceled') return 'cancelled'
  if (s === 'failed') return 'failed'
  return 'pending'
}

/**
 * Crée une facture de paiement (checkout-invoice). Retourne le token + l'URL de la page hébergée
 * (QR / redirection client). Le montant est en XOF (devise native UEMOA — pas de conversion).
 */
export async function createInvoice(opts: {
  amount:       number          // entier XOF
  description:  string
  storeName:    string
  cancelUrl:    string
  returnUrl:    string
  callbackUrl:  string
  customData?:  Record<string, unknown>
}): Promise<{ token: string; url: string }> {
  // Refus TYPÉ avant tout réseau (la route pré-refuse déjà en 503 ; ceinture et bretelles).
  requireProvider('paydunya')
  const res = await fetch(`${BASE}/checkout-invoice/create`, {
    method:  'POST',
    headers: headers(),
    body: JSON.stringify({
      invoice: {
        total_amount: Math.round(opts.amount),
        description:  opts.description,
      },
      store:   { name: opts.storeName },
      actions: {
        cancel_url:   opts.cancelUrl,
        return_url:   opts.returnUrl,
        callback_url: opts.callbackUrl,
      },
      custom_data: opts.customData ?? {},
    }),
  })

  const bodyText = await res.text().catch(() => '')
  let data: any
  try { data = JSON.parse(bodyText) } catch {
    throw new Error(`PayDunya create: réponse non-JSON — ${bodyText.slice(0, 200)}`)
  }
  // response_code "00" = succès. Le token + l'URL hébergée sont dans token / response_text.
  if (!res.ok || data.response_code !== '00' || !data.token) {
    throw new Error(`PayDunya create échec: ${data.response_text ?? data.response_code ?? res.status}`)
  }
  return { token: data.token as string, url: (data.response_text ?? data.invoice_url ?? '') as string }
}

/** Vérifie le statut d'une facture par token (polling). */
export async function confirmInvoice(token: string): Promise<{ status: ReturnType<typeof normalizeStatus>; raw: any }> {
  requireProvider('paydunya')
  const res = await fetch(`${BASE}/checkout-invoice/confirm/${encodeURIComponent(token)}`, {
    headers: headers(),
  })
  const bodyText = await res.text().catch(() => '')
  let data: any
  try { data = JSON.parse(bodyText) } catch {
    throw new Error(`PayDunya confirm: réponse non-JSON — ${bodyText.slice(0, 200)}`)
  }
  return { status: normalizeStatus(data.status), raw: data }
}

/**
 * Vérifie l'authenticité d'un IPN PayDunya : le champ `hash` du payload = SHA-512 hex de la
 * Master Key. Comparaison timing-safe. Fail-closed : master key absente ou hash absent → false.
 */
export function verifyIpnHash(receivedHash?: string, masterKey = process.env.PAYDUNYA_MASTER_KEY): boolean {
  if (!masterKey || !receivedHash) return false
  const expected = createHash('sha512').update(masterKey).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(receivedHash), Buffer.from(expected))
  } catch {
    // longueurs différentes → timingSafeEqual lève
    return false
  }
}
