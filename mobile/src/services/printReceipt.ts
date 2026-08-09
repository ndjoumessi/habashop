import * as Print from 'expo-print'
import { vatBreakdown } from '@/stores/posStore'
import { logger } from '@/lib/logger'
import { mixedSplitParts, type TicketOptions } from '@/services/whatsappTicket'
import { appUrlHost } from '@/lib/appUrl'
import { paymentModeLabel } from '@/lib/paymentLabel'
import { escHtml } from '@/lib/html'

// Reçu imprimable / PDF via la boîte de dialogue d'impression de l'OS (AirPrint iOS,
// service d'impression Android → imprimante Bluetooth thermique ou « Enregistrer en PDF »).
// Réutilise la même donnée que le ticket WhatsApp (TicketOptions) + vatBreakdown.

const L: Record<string, Record<string, string>> = {
  title:   { fr: 'Reçu de vente', en: 'Sales receipt', es: 'Recibo de venta', it: 'Ricevuta di vendita' },
  thanks:  { fr: 'Merci pour votre achat !', en: 'Thank you for your purchase!', es: '¡Gracias por su compra!', it: 'Grazie per il suo acquisto!' },
  total:   { fr: 'Total', en: 'Total', es: 'Total', it: 'Totale' },
  ht:      { fr: 'Total HT', en: 'Net (excl. tax)', es: 'Total sin IVA', it: 'Totale netto' },
  vat:     { fr: 'TVA', en: 'VAT', es: 'IVA', it: 'IVA' },
  ttc:     { fr: 'TTC', en: 'incl. tax', es: 'con IVA', it: 'IVA incl.' },
  payment: { fr: 'Paiement', en: 'Payment', es: 'Pago', it: 'Pagamento' },
  cash:    { fr: 'Espèces', en: 'Cash', es: 'Efectivo', it: 'Contanti' },
  card:    { fr: 'Carte', en: 'Card', es: 'Tarjeta', it: 'Carta' },
  mixed:   { fr: 'Mixte', en: 'Split', es: 'Mixto', it: 'Misto' },
  ref:     { fr: 'Réf', en: 'Ref', es: 'Ref', it: 'Rif' },
  qty:     { fr: 'Qté', en: 'Qty', es: 'Cant', it: 'Qtà' },
}
const t = (key: string, lang: string): string => L[key]?.[lang] ?? L[key]?.['fr'] ?? key

// Échappe le texte injecté dans le HTML — règle canonique partagée.
const esc = escHtml

function buildReceiptHtml(opts: TicketOptions): string {
  const { items, total, paymentMode, saleId, shopName, lang, vatRate, fmt, split } = opts
  const vat = vatBreakdown(total, vatRate)
  const locale = lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
  const date = new Date().toLocaleDateString(locale, {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  // ⚠️ Cinq modes serveur, trois branches : une vente MTN MoMo s'imprimait « Carte » sur
  // le document remis à l'acheteur. Le Record de `@/lib/paymentLabel` est exhaustif et
  // partagé avec `whatsappTicket.ts`, qui portait la même chaîne — c'était un jumeau.
  const payLabel = paymentModeLabel(paymentMode, lang)

  // Paiement : mixte → ligne « Mixte » + détail indenté par méthode ; sinon libellé simple.
  const paymentHtml = paymentMode === 'mixed' && split
    ? `<div class="row"><span>${t('payment', lang)}</span><span>${t('mixed', lang)}</span></div>` +
      mixedSplitParts(split, lang)
        .map((p) => `<div class="row" style="padding-left:10px;color:#444"><span>${esc(p.label)}</span><span>${fmt(p.amount)}</span></div>`)
        .join('')
    : `<div class="row"><span>${t('payment', lang)}</span><span>${esc(payLabel)}</span></div>`

  const rows = items.map((it) => `
    <tr>
      <td>${esc(it.name)}</td>
      <td class="r">${it.quantity} × ${fmt(it.price)}</td>
      <td class="r b">${fmt(it.price * it.quantity)}</td>
    </tr>`).join('')

  const vatRows = vat.rate > 0 ? `
    <div class="row"><span>${t('ht', lang)}</span><span>${fmt(vat.ht)}</span></div>
    <div class="row"><span>${t('vat', lang)} ${vat.rate}%</span><span>${fmt(vat.tva)}</span></div>` : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', monospace; width: 280px; margin: 0 auto; padding: 12px; color: #000; }
    h1 { font-size: 18px; text-align: center; margin: 0 0 2px; }
    .sub { text-align: center; font-size: 12px; color: #444; margin: 0; }
    hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 2px 0; vertical-align: top; }
    .r { text-align: right; white-space: nowrap; padding-left: 6px; }
    .b { font-weight: 700; }
    .row { display: flex; justify-content: space-between; font-size: 12px; padding: 1px 0; }
    .total { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; margin-top: 4px; }
    .foot { text-align: center; font-size: 12px; margin-top: 10px; }
    .ref { text-align: center; font-size: 11px; color: #666; margin-top: 6px; }
  </style></head><body>
    <h1>${esc(shopName)}</h1>
    <p class="sub">${t('title', lang)}</p>
    <p class="sub">${date}</p>
    <hr/>
    <table>${rows}</table>
    <hr/>
    ${vatRows}
    <div class="total"><span>${t('total', lang)}${vat.rate > 0 ? ' ' + t('ttc', lang) : ''}</span><span>${fmt(total)}</span></div>
    ${paymentHtml}
    <div class="ref">${t('ref', lang)}: #${saleId.slice(-6).toUpperCase()}</div>
    <p class="foot">${t('thanks', lang)}<br/>${appUrlHost()}</p>
  </body></html>`
}

// Ouvre la boîte d'impression de l'OS. Renvoie false si échec/annulation (à logger,
// pas à présenter comme une erreur bloquante : annuler l'impression est normal).
export async function printReceipt(opts: TicketOptions): Promise<boolean> {
  try {
    await Print.printAsync({ html: buildReceiptHtml(opts) })
    return true
  } catch (e) {
    logger.warn('Impression du reçu échouée/annulée:', e)
    return false
  }
}
