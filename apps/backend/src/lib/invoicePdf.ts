import PDFDocument from 'pdfkit'
import { TO_XOF_RATES } from './currency'

// ── Numérotation (pure, testable) ──
/** Numéro de facture séquentiel par tenant : FAC-{YYYY}-{NNNNN}. count = nb de factures déjà émises. */
export function nextInvoiceNumber(count: number, year: number): string {
  const seq = String(Math.max(0, Math.floor(count)) + 1).padStart(5, '0')
  return `FAC-${year}-${seq}`
}

// ── Formatage monétaire : montant base XOF → devise du tenant (sans arrondi prématuré) ──
const DECIMALS: Record<string, number> = { XOF: 0, XAF: 0 }
const SYMBOL: Record<string, string> = { XOF: 'FCFA', XAF: 'FCFA', EUR: '€', USD: '$', CAD: 'CA$', GBP: '£' }
export function fmtMoney(amountXOF: number, currency: string): string {
  const rate = TO_XOF_RATES[currency] ?? 1
  const v = (Number(amountXOF) || 0) / rate
  const dec = DECIMALS[currency] ?? 2
  const num = v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  const sym = SYMBOL[currency] ?? currency
  return ['EUR', 'XOF', 'XAF', 'CAD'].includes(currency) ? `${num} ${sym}` : `${sym}${num}`
}

// ── Libellés localisés (fr/en/es/it) ──
type Lang = 'fr' | 'en' | 'es' | 'it'
const L = (lang: string) => (fr: string, en: string, es: string, it: string) =>
  lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
function payLabel(mode: string, lang: string): string {
  const i = L(lang)
  switch (mode) {
    case 'cash':   return i('Espèces', 'Cash', 'Efectivo', 'Contanti')
    case 'card':   return i('Carte', 'Card', 'Tarjeta', 'Carta')
    case 'wave':   return 'Wave'
    case 'orange': return 'Orange Money'
    case 'mtn':    return 'MTN MoMo'
    default:       return i('Mobile', 'Mobile', 'Móvil', 'Mobile')
  }
}
function dloc(lang: string): string {
  return lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : lang === 'it' ? 'it-IT' : 'fr-FR'
}

export interface InvoiceSale {
  id: string; total: number; paymentMode: string; discountAmount: number; createdAt: Date | string
  invoiceNumber: string
  cashAmount?: number | null; mobileMoneyAmount?: number | null; cardAmount?: number | null
  items: { qty: number; unitPrice: number; total: number; product?: { name?: string | null } | null }[]
}
export interface InvoiceTenant { name: string; address?: string | null; phone?: string | null; email?: string | null; currency: string; vatRate: number; lang?: string | null }
export interface InvoiceCustomer { name: string; phone?: string | null }

/** Rend la facture A4 en Buffer PDF (pdfkit). Localisée selon tenant.lang. */
export function buildInvoicePdf(sale: InvoiceSale, tenant: InvoiceTenant, customer: InvoiceCustomer | null): Promise<Buffer> {
  const lang = (tenant.lang as Lang) || 'fr'
  const i = L(lang)
  const cur = tenant.currency || 'XOF'
  const M = (xof: number) => fmtMoney(xof, cur)
  const date = new Date(sale.createdAt)
  const dateStr = date.toLocaleDateString(dloc(lang), { day: '2-digit', month: 'long', year: 'numeric' })

  // Totaux : sale.total = TTC. On dérive HT + TVA si vatRate > 0.
  const totalTTC = sale.total
  const vat = Number(tenant.vatRate) || 0
  const subtotalHT = vat > 0 ? totalTTC / (1 + vat / 100) : totalTTC
  const vatAmount = totalTTC - subtotalHT

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))))

  const VIOLET = '#6C47FF'
  const GREY = '#666666'
  const left = 50
  const right = 545

  // En-tête tenant
  doc.fillColor(VIOLET).font('Helvetica-Bold').fontSize(20).text(tenant.name || 'HabaShop', left, 50)
  doc.fillColor(GREY).font('Helvetica').fontSize(9)
  let hy = 74
  if (tenant.address) { doc.text(tenant.address, left, hy); hy += 12 }
  const contact = [tenant.phone, tenant.email].filter(Boolean).join('  ·  ')
  if (contact) { doc.text(contact, left, hy); hy += 12 }

  // Bloc facture (droite)
  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(16).text(i('FACTURE', 'INVOICE', 'FACTURA', 'FATTURA'), 330, 50, { width: 215, align: 'right' })
  doc.font('Helvetica').fontSize(10).fillColor('#111111')
  doc.text(`N° ${sale.invoiceNumber}`, 330, 74, { width: 215, align: 'right' })
  doc.fillColor(GREY).text(`${i('Date', 'Date', 'Fecha', 'Data')} : ${dateStr}`, 330, 88, { width: 215, align: 'right' })

  // Séparateur
  doc.moveTo(left, 116).lineTo(right, 116).strokeColor('#DDDDDD').stroke()

  // Client
  let y = 132
  if (customer) {
    doc.fillColor(GREY).font('Helvetica-Bold').fontSize(9).text(i('FACTURÉ À', 'BILLED TO', 'FACTURADO A', 'FATTURATO A'), left, y)
    doc.fillColor('#111111').font('Helvetica').fontSize(11).text(customer.name, left, y + 13)
    if (customer.phone) doc.fillColor(GREY).fontSize(9).text(customer.phone, left, y + 28)
    y += 50
  }

  // En-tête tableau
  const cols = { name: left, qty: 320, pu: 380, tot: 470 }
  doc.fillColor('#FFFFFF').rect(left, y, right - left, 22).fill(VIOLET)
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
  doc.text(i('Article', 'Item', 'Artículo', 'Articolo'), cols.name + 8, y + 7)
  doc.text(i('Qté', 'Qty', 'Cant.', 'Qtà'), cols.qty, y + 7, { width: 50, align: 'center' })
  doc.text('PU', cols.pu, y + 7, { width: 80, align: 'right' })
  doc.text('Total', cols.tot, y + 7, { width: 75, align: 'right' })
  y += 22

  // Lignes
  doc.font('Helvetica').fontSize(9)
  for (const it of sale.items) {
    const rowH = 20
    doc.fillColor('#111111').text(it.product?.name ?? i('Produit', 'Product', 'Producto', 'Prodotto'), cols.name + 8, y + 6, { width: cols.qty - cols.name - 12 })
    doc.fillColor('#333333')
    doc.text(String(it.qty), cols.qty, y + 6, { width: 50, align: 'center' })
    doc.text(M(it.unitPrice), cols.pu, y + 6, { width: 80, align: 'right' })
    doc.text(M(it.total), cols.tot, y + 6, { width: 75, align: 'right' })
    doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor('#EEEEEE').stroke()
    y += rowH
  }

  // Totaux
  y += 12
  const totX = 330
  const line = (label: string, val: string, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor(bold ? '#111111' : GREY)
    doc.text(label, totX, y, { width: 110 })
    doc.fillColor(bold ? VIOLET : '#111111').text(val, totX + 110, y, { width: 105, align: 'right' })
    y += bold ? 22 : 16
  }
  if (sale.discountAmount > 0) line(i('Remise', 'Discount', 'Descuento', 'Sconto'), `- ${M(sale.discountAmount)}`)
  if (vat > 0) {
    line(i('Sous-total HT', 'Subtotal', 'Subtotal', 'Imponibile'), M(subtotalHT))
    line(`${i('TVA', 'VAT', 'IVA', 'IVA')} (${vat}%)`, M(vatAmount))
  }
  doc.moveTo(totX, y).lineTo(right, y).strokeColor('#DDDDDD').stroke(); y += 8
  line(i('Total TTC', 'Total', 'Total', 'Totale'), M(totalTTC), true)

  // Paiement
  y += 12
  doc.font('Helvetica').fontSize(10).fillColor('#333333')
  if (sale.paymentMode === 'mixed') {
    // Paiement mixte → une ligne par mode non nul.
    doc.text(`${i('Paiement mixte', 'Split payment', 'Pago mixto', 'Pagamento misto')} :`, left, y); y += 14
    const lines: string[] = []
    if ((sale.cashAmount ?? 0) > 0) lines.push(`${i('Espèces', 'Cash', 'Efectivo', 'Contanti')} : ${M(sale.cashAmount as number)}`)
    if ((sale.mobileMoneyAmount ?? 0) > 0) lines.push(`Mobile Money : ${M(sale.mobileMoneyAmount as number)}`)
    if ((sale.cardAmount ?? 0) > 0) lines.push(`${i('Carte', 'Card', 'Tarjeta', 'Carta')} : ${M(sale.cardAmount as number)}`)
    for (const ln of lines) { doc.text(`• ${ln}`, left + 12, y); y += 14 }
    doc.fillColor('#0A8F4E').text(`${i('Payée le', 'Paid on', 'Pagada el', 'Pagata il')} ${dateStr}`, left, y + 2)
  } else {
    doc.text(`${i('Mode de paiement', 'Payment method', 'Método de pago', 'Metodo di pagamento')} : ${payLabel(sale.paymentMode, lang)}`, left, y)
    doc.fillColor('#0A8F4E').text(`${i('Payée le', 'Paid on', 'Pagada el', 'Pagata il')} ${dateStr}`, left, y + 16)
  }

  // Pied
  doc.fillColor(GREY).font('Helvetica-Oblique').fontSize(10).text(
    i(`Merci pour votre confiance — ${tenant.name}`, `Thank you for your business — ${tenant.name}`, `Gracias por su confianza — ${tenant.name}`, `Grazie per la fiducia — ${tenant.name}`),
    left, 760, { width: right - left, align: 'center' },
  )

  doc.end()
  return done
}
