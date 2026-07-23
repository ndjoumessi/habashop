import { sendWhatsApp } from '../lib/spend/twilioClient'
import { redactError } from '../lib/redactPhone'
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
export interface WaTenant { id: string; name: string; currency: string; lang?: string | null; enableLoyalty?: boolean; pointsPerAmount?: number | null; enableAutoWhatsApp?: boolean }

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

/**
 * Envoie le reçu WhatsApp après une vente — SI : client a un téléphone, tenant a activé
 * enableAutoWhatsApp, et l'envoi est AUTORISÉ (boutique non démo, essai valide, quota
 * disponible). Fail silencieux sinon. Ne doit JAMAIS throw vers l'appelant : une vente
 * ne doit pas échouer parce que WhatsApp est refusé ou indisponible.
 *
 * ⚠️ C'était LE plus gros poste Twilio non gardé : déclenché par POST /api/sales, il
 * échappait aux gardes posées sur les routes /api/whatsapp/*. La garde vit désormais
 * dans le client, donc ce chemin ne peut plus l'oublier.
 */
export async function sendSaleWhatsApp(sale: WaSale, items: WaItem[], customer: WaCustomer, tenant: WaTenant): Promise<boolean> {
  try {
    if (!tenant.enableAutoWhatsApp) return false
    if (!customer?.phone) return false
    const body = buildSaleMessage(sale, items, customer, tenant)
    // Numéro du CLIENT : le pays de la boutique n'apprend rien sur lui → jamais normalisé.
    const res = await sendWhatsApp({ tenantId: tenant.id, to: customer.phone, body, audience: 'customer' })
    if (res.denied) {
      console.warn(`[whatsappSend] reçu non envoyé (${res.code}) tenant=${tenant.id}`)
      return false
    }
    return res.sent > 0
  } catch (e: any) {
    console.warn('[whatsappSend] échec envoi (non bloquant):', redactError(e))
    return false
  }
}
