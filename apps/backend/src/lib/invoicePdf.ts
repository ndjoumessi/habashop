import PDFDocument from 'pdfkit'
import { TO_XOF_RATES } from './currency'

// ── Numérotation (pure, testable) ──
/** Numéro de facture séquentiel par tenant : FAC-{YYYY}-{NNNNN}. count = nb de factures déjà émises. */
export function nextInvoiceNumber(count: number, year: number): string {
  const seq = String(Math.max(0, Math.floor(count)) + 1).padStart(5, '0')
  return `FAC-${year}-${seq}`
}

/**
 * Normalise les espaces insécables — U+202F (séparateur de milliers d'Intl fr-FR)
 * et U+00A0 — en espace simple. Les polices standard PDF (Helvetica, encodage
 * WinAnsi) n'ont PAS de glyphe U+202F : pdfkit le rend « / » (« 8 /500 FCFA »).
 * Choix : normaliser la chaîne plutôt qu'embarquer une police TTF — zéro asset,
 * zéro poids, rendu identique (l'espace simple existe dans toutes les polices) ;
 * une TTF n'apporterait rien d'autre ici (WinAnsi couvre déjà €/£/$).
 */
export function pdfSafeSpaces(s: string): string {
  return s.replace(/[\u202F\u00A0]/g, ' ')
}

// ── Formatage monétaire : montant base XOF → devise du tenant (sans arrondi prématuré) ──
const DECIMALS: Record<string, number> = { XOF: 0, XAF: 0 }
const SYMBOL: Record<string, string> = { XOF: 'FCFA', XAF: 'FCFA', EUR: '€', USD: '$', CAD: 'CA$', GBP: '£' }
export function fmtMoney(amountXOF: number, currency: string): string {
  const rate = TO_XOF_RATES[currency] ?? 1
  const v = (Number(amountXOF) || 0) / rate
  const dec = DECIMALS[currency] ?? 2
  const num = pdfSafeSpaces(v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }))
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
export interface InvoiceTenant {
  name: string; address?: string | null; phone?: string | null; email?: string | null
  currency: string; vatRate: number; lang?: string | null
  // Identifiants légaux (pied de page) — affichés UNIQUEMENT si renseignés
  ninea?: string | null; rccm?: string | null; vatNumber?: string | null
}
export interface InvoiceCustomer { name: string; phone?: string | null }

// Logo « Sac + H » — même dessin que components/ui/LogoMark.tsx (frontend), tracé
// en vectoriel pdfkit (tuile violette arrondie, anse or, sac blanc, monogramme H).
function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number, size: number) {
  const s = size / 100
  doc.save().translate(x, y).scale(s)
  doc.roundedRect(0, 0, 100, 100, 24).fill('#6C47FF')
  doc.path('M38 38 C38 24 62 24 62 38').lineWidth(4.5).lineCap('round').strokeColor('#F0A500').stroke()
  doc.roundedRect(29, 37, 42, 40, 5).fill('#FFFFFF')
  doc.roundedRect(44, 46, 4.6, 22, 1.4).fill('#6C47FF')
  doc.roundedRect(52, 46, 4.6, 22, 1.4).fill('#6C47FF')
  doc.roundedRect(44, 55, 12.6, 4.6, 1.4).fill('#6C47FF')
  doc.restore()
}

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

  // En-tête : logo Sac+H + nom boutique (gauche) · FACTURE + N° + date (droite)
  drawLogo(doc, left, 46, 40)
  doc.fillColor('#111111').font('Helvetica-Bold').fontSize(17).text(tenant.name || 'HabaShop', left + 52, 50)
  doc.fillColor(GREY).font('Helvetica').fontSize(8.5)
  let hy = 70
  if (tenant.address) { doc.text(tenant.address, left + 52, hy); hy += 11 }
  const contact = [tenant.phone, tenant.email].filter(Boolean).join('  ·  ')
  if (contact) { doc.text(contact, left + 52, hy); hy += 11 }

  doc.fillColor(VIOLET).font('Helvetica-Bold').fontSize(18).text(i('FACTURE', 'INVOICE', 'FACTURA', 'FATTURA'), 330, 48, { width: 215, align: 'right', characterSpacing: 1 })
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#111111')
  doc.text(`N° ${sale.invoiceNumber}`, 330, 72, { width: 215, align: 'right' })
  doc.font('Helvetica').fillColor(GREY).fontSize(9).text(`${i('Date', 'Date', 'Fecha', 'Data')} : ${dateStr}`, 330, 86, { width: 215, align: 'right' })

  // Statut « ● Payée » — toujours à droite, à la même hauteur (indépendant du client).
  // Cercle + texte : le glyphe « ● » n'existe pas en WinAnsi.
  let y = 128
  {
    const pillW = 64
    doc.roundedRect(right - pillW, y + 4, pillW, 20, 10).fillAndStroke('#E7F7EF', '#BFE8D2')
    doc.circle(right - pillW + 13, y + 14, 2.6).fill('#0E8A55')
    doc.fillColor('#0E8A55').font('Helvetica-Bold').fontSize(9)
      .text(i('Payée', 'Paid', 'Pagada', 'Pagata'), right - pillW + 20, y + 10)
  }
  // Bloc « FACTURÉ À » — UNIQUEMENT si un client est rattaché. Vente de passage
  // (pas de client) → bloc entièrement masqué, jamais de « — » nu sur un document
  // officiel (même règle que les mentions légales vides). L'espacement se resserre.
  if (customer) {
    doc.fillColor(GREY).font('Helvetica-Bold').fontSize(8).text(i('FACTURÉ À', 'BILLED TO', 'FACTURADO A', 'FATTURATO A'), left, y, { characterSpacing: .8 })
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(12).text(customer.name, left, y + 12)
    if (customer.phone) doc.fillColor(GREY).font('Helvetica').fontSize(9).text(customer.phone, left, y + 28)
    y += 50
  } else {
    y += 30 // hauteur de la pill seule + petit espace : pas de trou
  }

  // En-tête tableau : libellés violets + filet violet 2 pt (plus de bandeau plein)
  const cols = { name: left, qty: 320, pu: 380, tot: 470 }
  doc.fillColor(VIOLET).font('Helvetica-Bold').fontSize(8.5)
  doc.text(i('ARTICLE', 'ITEM', 'ARTÍCULO', 'ARTICOLO'), cols.name, y + 6, { characterSpacing: .6 })
  doc.text(i('QTÉ', 'QTY', 'CANT.', 'QTÀ'), cols.qty, y + 6, { width: 50, align: 'center', characterSpacing: .6 })
  doc.text(i('PU', 'UNIT PRICE', 'PRECIO UNIT.', 'PREZZO UNIT.'), cols.pu, y + 6, { width: 80, align: 'right', characterSpacing: .6 })
  doc.text(i('TOTAL', 'TOTAL', 'TOTAL', 'TOTALE'), cols.tot, y + 6, { width: 65, align: 'right', characterSpacing: .6 })
  doc.moveTo(left, y + 20).lineTo(right, y + 20).lineWidth(2).strokeColor(VIOLET).stroke()
  doc.lineWidth(1)
  y += 22

  // Lignes
  doc.font('Helvetica').fontSize(9)
  for (const it of sale.items) {
    const rowH = 20
    doc.fillColor('#111111').text(it.product?.name ?? i('Produit', 'Product', 'Producto', 'Prodotto'), cols.name, y + 6, { width: cols.qty - cols.name - 12 })
    doc.fillColor('#333333')
    doc.text(String(it.qty), cols.qty, y + 6, { width: 50, align: 'center' })
    doc.text(M(it.unitPrice), cols.pu, y + 6, { width: 80, align: 'right' })
    doc.text(M(it.total), cols.tot, y + 6, { width: 65, align: 'right' })
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
  doc.moveTo(totX, y).lineTo(right, y).lineWidth(2).strokeColor(VIOLET).stroke(); doc.lineWidth(1); y += 8
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

  // Pied : mentions légales (UNIQUEMENT si configurées sur le tenant) + remerciement
  const legalParts = [
    tenant.ninea ? `NINEA ${tenant.ninea}` : null,
    tenant.rccm ? `RC ${tenant.rccm}` : null,
    tenant.vatNumber ? `N° TVA ${tenant.vatNumber}` : null,
  ].filter(Boolean) as string[]
  doc.moveTo(left, 742).lineTo(right, 742).strokeColor('#ECECF2').stroke()
  if (legalParts.length) {
    doc.fillColor(GREY).font('Helvetica').fontSize(8).text(
      `${tenant.name} · ${legalParts.join(' · ')}`,
      left, 750, { width: right - left, align: 'center' },
    )
  }
  doc.fillColor(VIOLET).font('Helvetica-Bold').fontSize(9.5).text(
    i('Merci de votre confiance', 'Thank you for your business', 'Gracias por su confianza', 'Grazie per la fiducia'),
    left, legalParts.length ? 763 : 752, { width: right - left, align: 'center' },
  )

  doc.end()
  return done
}
