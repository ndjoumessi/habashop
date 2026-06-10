import twilio from 'twilio'
import { xofToCurrency } from '../lib/currency'
import { pointsForAmount } from '../lib/loyalty'

const SYMBOL: Record<string, string> = { XOF: 'FCFA', XAF: 'FCFA', EUR: '€', USD: '$', CAD: 'CA$', GBP: '£' }

export const localeOf = (lang: string) => lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'

export function fmtMoney(amountXOF: number, currency: string): string {
  const v = xofToCurrency(Number(amountXOF) || 0, currency)
  const sym = SYMBOL[currency] ?? currency
  const num = v.toLocaleString('fr-FR')
  return ['XOF', 'XAF', 'EUR', 'CAD'].includes(currency) ? `${num} ${sym}` : `${sym}${num}`
}

function payLabel(mode: string, lang: string): string {
  const i = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  switch (mode) {
    case 'cash':   return i('Espèces', 'Cash', 'Efectivo', 'Contanti')
    case 'card':   return i('Carte', 'Card', 'Tarjeta', 'Carta')
    case 'wave':   return 'Wave'
    case 'orange': return 'Orange Money'
    case 'mtn':    return 'MTN MoMo'
    case 'mixed':  return i('Mixte', 'Mixed', 'Mixto', 'Misto')
    default:       return i('Mobile', 'Mobile', 'Móvil', 'Mobile')
  }
}

export interface WaSale { id: string; total: number; paymentMode: string; createdAt: Date | string }
export interface WaItem { qty: number; total: number; product?: { name?: string | null } | null; name?: string }
export interface WaCustomer { name?: string | null; phone?: string | null }
export interface WaTenant { name: string; currency: string; lang?: string | null; enableLoyalty?: boolean; pointsPerAmount?: number | null; enableAutoWhatsApp?: boolean }

/** Construit le texte du reçu WhatsApp (pur, testable). Même structure que le ticket. */
export function buildSaleMessage(sale: WaSale, items: WaItem[], customer: WaCustomer, tenant: WaTenant): string {
  const lang = tenant.lang ?? 'fr'
  const i = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const cur = tenant.currency || 'XOF'
  const M = (xof: number) => fmtMoney(xof, cur)
  const ref = `V${String(sale.id).slice(-6).toUpperCase()}`
  const lines = items.map(it => `• ${(it.product?.name ?? it.name ?? i('Produit', 'Product', 'Producto', 'Prodotto'))} ×${it.qty}  —  ${M(it.total)}`)
  let msg = `🧾 *${tenant.name}*\n${i('Reçu', 'Receipt', 'Recibo', 'Ricevuta')} #${ref}\n\n${lines.join('\n')}\n────────\n*${i('Total', 'Total', 'Total', 'Totale')} : ${M(sale.total)}*\n${i('Paiement', 'Payment', 'Pago', 'Pagamento')} : ${payLabel(sale.paymentMode, lang)}`
  if (tenant.enableLoyalty) {
    const pts = pointsForAmount(sale.total, tenant.pointsPerAmount ?? undefined)
    if (pts > 0) msg += `\n⭐ +${pts} ${i('points fidélité', 'loyalty points', 'puntos de fidelidad', 'punti fedeltà')}`
  }
  msg += `\n\n${i('Merci de votre visite ! 🙏', 'Thank you for your visit! 🙏', '¡Gracias por su visita! 🙏', 'Grazie della visita! 🙏')}`
  return msg
}

function getClient() {
  const sid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim()
  const token = (process.env.TWILIO_AUTH_TOKEN ?? '').trim()
  if (!sid || !token) return null
  try { return twilio(sid, token) } catch { return null }
}

/**
 * Envoie le reçu WhatsApp après une vente — SI : client a un téléphone, tenant a activé
 * enableAutoWhatsApp, et les 3 vars Twilio sont présentes. Fail silencieux + warning sinon.
 * Ne doit JAMAIS throw vers l'appelant (la vente ne doit pas échouer si WhatsApp échoue).
 */
export async function sendSaleWhatsApp(sale: WaSale, items: WaItem[], customer: WaCustomer, tenant: WaTenant): Promise<boolean> {
  try {
    if (!tenant.enableAutoWhatsApp) return false
    if (!customer?.phone) return false
    const from = (process.env.TWILIO_WHATSAPP_FROM ?? '').trim()
    const client = getClient()
    if (!client || !from) {
      console.warn('[whatsappSend] config Twilio incomplète (SID/TOKEN/FROM) → envoi auto ignoré')
      return false
    }
    const body = buildSaleMessage(sale, items, customer, tenant)
    await client.messages.create({ from, to: `whatsapp:${customer.phone}`, body })
    return true
  } catch (e: any) {
    console.warn('[whatsappSend] échec envoi (non bloquant):', e?.message ?? e)
    return false
  }
}
