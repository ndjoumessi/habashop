import { Linking } from 'react-native'
import { vatBreakdown } from '@/stores/posStore'
import type { CartItem } from '@/stores/posStore'
import type { MixedSplit } from '@/lib/paymentSplit'
import { appUrlHost } from '@/lib/appUrl'
import { paymentModeLabelWithEmoji } from '@/lib/paymentLabel'

export interface TicketOptions {
  items:       CartItem[]
  total:       number
  paymentMode: string
  saleId:      string
  shopName:    string
  currency:    string
  lang:        string
  vatRate?:    number
  fmt:         (n: number) => string
  // Ventilation d'un paiement mixte (paymentMode==='mixed') → détaillée sur le reçu.
  split?:      MixedSplit
}

// Labels par langue
const LABELS: Record<string, Record<string, string>> = {
  title:   { fr: 'Reçu de vente', en: 'Sales receipt', es: 'Recibo de venta', it: 'Ricevuta di vendita' },
  thanks:  { fr: 'Merci pour votre achat !', en: 'Thank you for your purchase!', es: '¡Gracias por su compra!', it: 'Grazie per il suo acquisto!' },
  total:   { fr: 'Total', en: 'Total', es: 'Total', it: 'Totale' },
  ht:      { fr: 'Total HT', en: 'Net (excl. tax)', es: 'Total sin IVA', it: 'Totale netto' },
  vat:     { fr: 'TVA', en: 'VAT', es: 'IVA', it: 'IVA' },
  ttc:     { fr: 'TTC', en: 'incl. tax', es: 'con IVA', it: 'IVA incl.' },
  payment: { fr: 'Paiement', en: 'Payment', es: 'Pago', it: 'Pagamento' },
  cash:    { fr: 'Espèces', en: 'Cash', es: 'Efectivo', it: 'Contanti' },
  mobile:  { fr: 'Mobile Money', en: 'Mobile Money', es: 'Dinero móvil', it: 'Mobile Money' },
  card:    { fr: 'Carte', en: 'Card', es: 'Tarjeta', it: 'Carta' },
  mixed:   { fr: 'Mixte', en: 'Split', es: 'Mixto', it: 'Misto' },
  ref:     { fr: 'Réf', en: 'Ref', es: 'Ref', it: 'Rif' },
}

function t(key: string, lang: string): string {
  return LABELS[key]?.[lang] ?? LABELS[key]?.['fr'] ?? key
}

// Détail d'un paiement mixte : libellé + montant des seaux NON nuls (partagé WhatsApp/PDF).
export function mixedSplitParts(split: MixedSplit, lang: string): { label: string; amount: number }[] {
  const parts: { label: string; amount: number }[] = []
  if (split.cashAmount > 0)        parts.push({ label: t('cash', lang),   amount: split.cashAmount })
  if (split.mobileMoneyAmount > 0) parts.push({ label: t('mobile', lang), amount: split.mobileMoneyAmount })
  if (split.cardAmount > 0)        parts.push({ label: t('card', lang),   amount: split.cardAmount })
  return parts
}

export function buildWhatsAppTicket(opts: TicketOptions, phone?: string): string {
  const { items, total, paymentMode, saleId, shopName, lang, vatRate, fmt, split } = opts
  const vat = vatBreakdown(total, vatRate)

  const date = new Date().toLocaleDateString(
    lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR',
    { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  )

  const lines: string[] = [
    `🛍️ *${shopName}*`,
    `📄 *${t('title', lang)}*`,
    `📅 ${date}`,
    '─────────────────',
  ]

  for (const item of items) {
    lines.push(`• ${item.name}\n  ${item.quantity} × ${fmt(item.price)} = *${fmt(item.price * item.quantity)}*`)
  }

  lines.push('─────────────────')
  if (vat.rate > 0) {
    lines.push(`${t('ht', lang)}: ${fmt(vat.ht)}`)
    lines.push(`${t('vat', lang)} ${vat.rate}%: ${fmt(vat.tva)}`)
  }
  lines.push(`💰 *${t('total', lang)}${vat.rate > 0 ? ' ' + t('ttc', lang) : ''}: ${fmt(total)}*`)

  if (paymentMode === 'mixed' && split) {
    // Paiement mixte : ligne « Mixte » + détail par méthode.
    lines.push(`💳 ${t('payment', lang)}: ${t('mixed', lang)}`)
    for (const p of mixedSplitParts(split, lang)) {
      lines.push(`   • ${p.label}: ${fmt(p.amount)}`)
    }
  } else {
    // Jumeau de `printReceipt.ts` : même Record, seul le pictogramme diffère.
    const payLabel = paymentModeLabelWithEmoji(paymentMode, lang)
    lines.push(`💳 ${t('payment', lang)}: ${payLabel}`)
  }
  lines.push(`🔖 ${t('ref', lang)}: #${saleId.slice(-6).toUpperCase()}`)
  lines.push('')
  lines.push(`✨ ${t('thanks', lang)}`)
  lines.push(`🌍 ${appUrlHost()}`)

  const encoded = encodeURIComponent(lines.join('\n'))

  if (phone) {
    const clean = phone.replace(/[\s\-()]/g, '')
    const intl = clean.startsWith('+') ? clean.slice(1) : clean
    return `whatsapp://send?phone=${intl}&text=${encoded}`
  }
  return `whatsapp://send?text=${encoded}`
}

export async function sendWhatsAppTicket(opts: TicketOptions, phone?: string): Promise<boolean> {
  try {
    const url = buildWhatsAppTicket(opts, phone)
    const canOpen = await Linking.canOpenURL('whatsapp://send')
    if (!canOpen) return false
    await Linking.openURL(url)
    return true
  } catch {
    return false
  }
}
