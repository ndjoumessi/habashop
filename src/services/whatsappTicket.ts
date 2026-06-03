import { Linking } from 'react-native'
import { vatBreakdown } from '@/stores/posStore'
import type { CartItem } from '@/stores/posStore'

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
  ref:     { fr: 'Réf', en: 'Ref', es: 'Ref', it: 'Rif' },
}

function t(key: string, lang: string): string {
  return LABELS[key]?.[lang] ?? LABELS[key]?.['fr'] ?? key
}

export function buildWhatsAppTicket(opts: TicketOptions, phone?: string): string {
  const { items, total, paymentMode, saleId, shopName, lang, vatRate, fmt } = opts
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

  const payLabel =
    paymentMode === 'cash'   ? t('cash', lang) :
    paymentMode === 'wave'   ? '🌊 Wave' :
    paymentMode === 'orange' ? '🟠 Orange Money' :
    '💳 ' + (lang === 'en' ? 'Card' : lang === 'es' ? 'Tarjeta' : lang === 'it' ? 'Carta' : 'Carte')

  lines.push(`💳 ${t('payment', lang)}: ${payLabel}`)
  lines.push(`🔖 ${t('ref', lang)}: #${saleId.slice(-6).toUpperCase()}`)
  lines.push('')
  lines.push(`✨ ${t('thanks', lang)}`)
  lines.push(`🌍 habashop.vercel.app`)

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
