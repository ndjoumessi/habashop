import { useAppStore } from '@/stores/appStore'

const LOCALES: Record<string, string> = {
  fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT',
}

const PDF_STR: Record<string, Record<string, string>> = {
  edited_on:    { fr: 'Édité le',                        en: 'Generated on',               es: 'Editado el',                   it: 'Generato il'              },
  at:           { fr: 'à',                               en: 'at',                          es: 'a las',                        it: 'alle'                     },
  confidential: { fr: 'Document confidentiel',           en: 'Confidential document',       es: 'Documento confidencial',       it: 'Documento riservato'      },
  auto_gen:     { fr: 'Généré automatiquement',          en: 'Auto-generated',              es: 'Generado automáticamente',     it: 'Generato automaticamente' },
  software:     { fr: 'Logiciel de gestion commerciale', en: 'Business management software', es: 'Software de gestión comercial', it: 'Software di gestione commerciale' },
}

function ps(key: string, lang: string): string {
  return PDF_STR[key]?.[lang] ?? PDF_STR[key]?.['fr'] ?? key
}

export const HABASHOP_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    color: #1a1a2e; font-size: 13px;
    padding: 30px; background: #fff;
  }
  .header {
    display: flex; align-items: center;
    justify-content: space-between;
    padding-bottom: 20px;
    border-bottom: 3px solid #5B4EE8;
    margin-bottom: 24px;
  }
  .logo { display: flex; align-items: center; gap: 12px; }
  .logo-icon {
    width: 44px; height: 44px; border-radius: 12px;
    background: linear-gradient(135deg, #5B4EE8, #7C6FF0);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 900; color: white;
  }
  .logo-name { font-size: 22px; font-weight: 900; color: #5B4EE8; letter-spacing: -0.5px; }
  .doc-info { text-align: right; }
  .doc-title { font-size: 16px; font-weight: 800; color: #5B4EE8; margin-bottom: 4px; }
  .doc-date { font-size: 11px; color: #888; }
  h2 {
    font-size: 14px; font-weight: 800; color: #1a1a2e;
    margin: 20px 0 12px; padding-bottom: 6px;
    border-bottom: 1px solid #e5e7eb;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  thead th {
    background: #5B4EE8; color: white;
    padding: 10px 12px; text-align: left;
    font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  thead th:first-child { border-radius: 8px 0 0 0; }
  thead th:last-child  { border-radius: 0 8px 0 0; }
  tbody td { padding: 9px 12px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
  tbody tr:nth-child(even) { background: #f8f7ff; }
  tbody tr:last-child td { border-bottom: none; }
  .total-row td {
    background: #f0effe !important;
    font-weight: 800; font-size: 13px;
    border-top: 2px solid #5B4EE8;
  }
  .badge {
    display: inline-block; padding: 2px 8px;
    border-radius: 20px; font-size: 10px; font-weight: 700;
  }
  .badge-green  { background: #d1fae5; color: #059669; }
  .badge-red    { background: #fee2e2; color: #dc2626; }
  .badge-amber  { background: #fef3c7; color: #d97706; }
  .badge-blue   { background: #dbeafe; color: #2563eb; }
  .badge-purple { background: #ede9fe; color: #7c3aed; }
  .kpi-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: 12px; margin: 16px 0;
  }
  .kpi-card {
    background: #f8f7ff; border: 1px solid #e5e7eb;
    border-radius: 10px; padding: 14px;
    border-left: 4px solid #5B4EE8;
  }
  .kpi-label {
    font-size: 9px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.8px;
    color: #888; margin-bottom: 6px;
  }
  .kpi-value { font-size: 18px; font-weight: 900; color: #5B4EE8; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; }
  .info-item { background: #f8f7ff; border-radius: 8px; padding: 10px 12px; }
  .info-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #888; margin-bottom: 4px; }
  .info-value { font-size: 13px; font-weight: 600; }
  .net-payer {
    display: flex; justify-content: space-between; align-items: center;
    background: linear-gradient(135deg, #f0effe, #e8e4ff);
    border: 2px solid #5B4EE8; border-radius: 12px;
    padding: 16px 20px; margin: 16px 0;
  }
  .net-label { font-size: 14px; font-weight: 800; color: #1a1a2e; }
  .net-value { font-size: 24px; font-weight: 900; color: #5B4EE8; }
  .footer {
    margin-top: 30px; padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    display: flex; justify-content: space-between;
    font-size: 10px; color: #aaa;
  }
  .signature-block { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  .signature-line {
    border-top: 1px solid #ccc; padding-top: 8px;
    font-size: 11px; color: #888; text-align: center; margin-top: 40px;
  }
  @media print {
    body { padding: 15px; }
    @page { margin: 1cm; size: A4; }
  }
`

// ─── FONCTION GÉNÉRIQUE PDF ───────────────────────────
export function openPDF(title: string, bodyHTML: string) {
  const { lang, currency, shopName } = useAppStore.getState()
  const locale = LOCALES[lang] ?? 'fr-FR'
  const now = new Date()
  const dateStr = now.toLocaleDateString(locale)
  const timeStr = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const name = shopName || 'HabaShop'
  const currLabel = currency !== 'XOF' ? ` · ${currency}` : ''

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    alert('Veuillez autoriser les popups pour ce site')
    return
  }
  win.document.write(`<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <title>${name} — ${title}</title>
  <style>${HABASHOP_STYLES}</style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <div class="logo-icon">H</div>
      <div>
        <div class="logo-name">${name}</div>
        <div style="font-size:11px;color:#888;">${ps('software', lang)}</div>
      </div>
    </div>
    <div class="doc-info">
      <div class="doc-title">${title}</div>
      <div class="doc-date">
        ${ps('edited_on', lang)} ${dateStr} ${ps('at', lang)} ${timeStr}${currLabel}
      </div>
    </div>
  </div>
  ${bodyHTML}
  <div class="footer">
    <span>${name} © ${now.getFullYear()} — ${ps('confidential', lang)}</span>
    <span>${ps('auto_gen', lang)}</span>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    }
  <\/script>
</body>
</html>`)
  win.document.close()
}

// ─── EXPORT CSV ──────────────────────────────────────
export function exportCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const BOM = '﻿'
  const csv = BOM + [
    headers.join(';'),
    ...rows.map(row =>
      row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';')
    ),
  ].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `HabaShop_${filename}_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── HELPERS HTML ────────────────────────────────────
export function htmlTable(
  headers: string[],
  rows: string[][],
  totalRow?: string[]
): string {
  return `
    <table>
      <thead>
        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
        ${totalRow ? `<tr class="total-row">${totalRow.map(cell => `<td>${cell}</td>`).join('')}</tr>` : ''}
      </tbody>
    </table>
  `
}

export function htmlKPIs(items: { label: string; value: string }[]): string {
  return `
    <div class="kpi-grid">
      ${items.map(k => `
        <div class="kpi-card">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-value">${k.value}</div>
        </div>
      `).join('')}
    </div>
  `
}

// ─── DEVIS / FACTURE PDF ─────────────────────
const INV_STR: Record<string, Record<string, string>> = {
  devis:        { fr: 'DEVIS',          en: 'QUOTE',        es: 'PRESUPUESTO',  it: 'PREVENTIVO'  },
  facture:      { fr: 'FACTURE',        en: 'INVOICE',      es: 'FACTURA',      it: 'FATTURA'     },
  ref:          { fr: 'Référence',      en: 'Reference',    es: 'Referencia',   it: 'Riferimento' },
  client:       { fr: 'Client',         en: 'Customer',     es: 'Cliente',      it: 'Cliente'     },
  date:         { fr: 'Date',           en: 'Date',         es: 'Fecha',        it: 'Data'        },
  valid_until:  { fr: "Valable jusqu'au", en: 'Valid until', es: 'Válido hasta', it: 'Valido fino' },
  description:  { fr: 'Description',   en: 'Description',  es: 'Descripción',  it: 'Descrizione' },
  qty:          { fr: 'Qté',           en: 'Qty',          es: 'Cant.',        it: 'Qtà'         },
  unit_price:   { fr: 'Prix unitaire', en: 'Unit price',   es: 'Precio unit.', it: 'Prezzo unit.'  },
  total:        { fr: 'Total',         en: 'Total',        es: 'Total',        it: 'Totale'      },
  subtotal:     { fr: 'Sous-total',    en: 'Subtotal',     es: 'Subtotal',     it: 'Subtotale'   },
  vat:          { fr: 'TVA (18 %)',    en: 'VAT (18 %)',   es: 'IVA (18 %)',   it: 'IVA (18 %)'  },
  discount:     { fr: 'Remise',        en: 'Discount',     es: 'Descuento',    it: 'Sconto'      },
  net_total:    { fr: 'NET À PAYER',   en: 'TOTAL DUE',    es: 'TOTAL A PAGAR', it: 'TOTALE DA PAGARE' },
  payment:      { fr: 'Mode de règlement', en: 'Payment method', es: 'Método de pago', it: 'Metodo pagamento' },
  thanks:       { fr: 'Merci pour votre confiance !', en: 'Thank you for your business!', es: '¡Gracias por su confianza!', it: 'Grazie per la fiducia!' },
  sign_client:  { fr: 'Signature client', en: 'Customer signature', es: 'Firma del cliente', it: 'Firma cliente' },
  sign_seller:  { fr: 'Signature vendeur', en: 'Seller signature',  es: 'Firma del vendedor', it: 'Firma venditore' },
}

function is(key: string, lang: string): string {
  return INV_STR[key]?.[lang] ?? INV_STR[key]?.['fr'] ?? key
}

export interface InvoiceItem {
  name: string
  qty: number
  price: number
  emoji?: string
}

export interface InvoiceOptions {
  type: 'devis' | 'facture'
  lang: string
  customer?: { name?: string; phone?: string; email?: string; address?: string }
  items: InvoiceItem[]
  discount?: { type: 'percent' | 'amount'; value: number }
  paymentMode?: string
  ref?: string
}

export function generateInvoice(opts: InvoiceOptions) {
  const { type, lang, customer, items, discount, paymentMode, ref } = opts
  const { currency, shopName } = useAppStore.getState()
  const locale = LOCALES[lang] ?? 'fr-FR'
  const now = new Date()
  const dateStr = now.toLocaleDateString(locale)
  const refStr = ref ?? `${type === 'devis' ? 'D' : 'F'}${Date.now().toString().slice(-6)}`
  const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(locale)

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  let discountAmt = 0
  if (discount) {
    discountAmt = discount.type === 'percent'
      ? Math.round(subtotal * discount.value / 100)
      : discount.value
  }
  const afterDiscount = subtotal - discountAmt
  const tva = Math.round(afterDiscount * 0.18)
  const netTotal = afterDiscount + tva

  const fmt = (v: number) => new Intl.NumberFormat(locale, { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' ' + (currency ?? 'XOF')

  const itemRows = items.map(i => `
    <tr>
      <td>${i.emoji ?? '📦'} ${i.name}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right;font-family:monospace">${fmt(i.price)}</td>
      <td style="text-align:right;font-family:monospace;font-weight:700">${fmt(i.price * i.qty)}</td>
    </tr>
  `).join('')

  const body = `
    ${customer?.name ? `
    <div class="info-grid" style="margin-bottom:20px">
      <div class="info-item">
        <div class="info-label">${is('ref', lang)}</div>
        <div class="info-value" style="font-family:monospace;font-size:15px;font-weight:900;color:#5B4EE8">${refStr}</div>
      </div>
      <div class="info-item">
        <div class="info-label">${is('date', lang)}</div>
        <div class="info-value">${dateStr}</div>
      </div>
      <div class="info-item">
        <div class="info-label">${is('client', lang)}</div>
        <div class="info-value">${customer.name}${customer.phone ? ' · ' + customer.phone : ''}</div>
      </div>
      ${type === 'devis' ? `<div class="info-item">
        <div class="info-label">${is('valid_until', lang)}</div>
        <div class="info-value">${validUntil}</div>
      </div>` : `<div class="info-item">
        <div class="info-label">${is('payment', lang)}</div>
        <div class="info-value">${paymentMode ?? '—'}</div>
      </div>`}
    </div>` : `
    <div class="info-grid" style="margin-bottom:20px">
      <div class="info-item">
        <div class="info-label">${is('ref', lang)}</div>
        <div class="info-value" style="font-family:monospace;font-size:15px;font-weight:900;color:#5B4EE8">${refStr}</div>
      </div>
      <div class="info-item">
        <div class="info-label">${is('date', lang)}</div>
        <div class="info-value">${dateStr}</div>
      </div>
    </div>`}

    <table>
      <thead>
        <tr>
          <th>${is('description', lang)}</th>
          <th style="text-align:center;width:60px">${is('qty', lang)}</th>
          <th style="text-align:right;width:110px">${is('unit_price', lang)}</th>
          <th style="text-align:right;width:110px">${is('total', lang)}</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-top:16px">
      <div style="min-width:280px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#666;border-bottom:1px solid #f0f0f0">
          <span>${is('subtotal', lang)}</span>
          <span style="font-family:monospace">${fmt(subtotal)}</span>
        </div>
        ${discountAmt > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#059669;border-bottom:1px solid #f0f0f0">
          <span>${is('discount', lang)} ${discount?.type === 'percent' ? '(' + discount.value + '%)' : ''}</span>
          <span style="font-family:monospace">− ${fmt(discountAmt)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;color:#666;border-bottom:1px solid #f0f0f0">
          <span>${is('vat', lang)}</span>
          <span style="font-family:monospace">${fmt(tva)}</span>
        </div>
        <div class="net-payer" style="margin-top:8px">
          <span class="net-label">${is('net_total', lang)}</span>
          <span class="net-value">${fmt(netTotal)}</span>
        </div>
      </div>
    </div>

    <div class="signature-block" style="margin-top:30px">
      <div class="signature-line">${is('sign_client', lang)}</div>
      <div class="signature-line">${is('sign_seller', lang)}</div>
    </div>

    <div style="margin-top:24px;text-align:center;font-size:13px;color:#5B4EE8;font-weight:700">${is('thanks', lang)}</div>
  `

  const title = `${is(type, lang)} ${refStr}`
  openPDF(title, body)
}

// ─── ÉTIQUETTES PRODUITS ─────────────────────
export function printProductLabels(
  products: { name: string; sku: string; price: number; barcode?: string; emoji?: string }[],
  fmt: (amount: number) => string,
  options: {
    size: 'small' | 'medium' | 'large'
    showPrice: boolean
    showSku: boolean
    showBarcode: boolean
    copies: number
    shopName: string
    lang: string
  }
) {
  const SIZES = {
    small:  { w: 150, h: 80,  fontSize: 10, priceSize: 14 },
    medium: { w: 200, h: 100, fontSize: 12, priceSize: 18 },
    large:  { w: 280, h: 140, fontSize: 14, priceSize: 24 },
  }
  const s = SIZES[options.size]

  const labelHTML = (product: typeof products[0]) => `
    <div style="
      width:${s.w}px; height:${s.h}px;
      border:1px solid #ddd; border-radius:6px;
      padding:8px; display:inline-flex;
      flex-direction:column; justify-content:space-between;
      margin:4px; background:white;
      page-break-inside:avoid;
    ">
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:${s.priceSize}px;">${product.emoji ?? '📦'}</span>
        <div>
          <div style="font-size:${s.fontSize}px;font-weight:700;line-height:1.2;color:#1a1a2e;">
            ${product.name.length > 20 ? product.name.slice(0, 20) + '...' : product.name}
          </div>
          ${options.showSku ? `<div style="font-size:9px;color:#888;">${product.sku}</div>` : ''}
        </div>
      </div>
      ${options.showPrice ? `
        <div style="font-size:${s.priceSize}px;font-weight:900;color:#5B4EE8;">
          ${fmt(product.price)}
        </div>
      ` : ''}
      ${options.showBarcode ? `
        <div style="font-size:8px;color:#888;text-align:center;
          border-top:1px solid #eee;padding-top:4px;
          font-family:monospace;">
          ${product.barcode ?? product.sku}
        </div>
      ` : ''}
      <div style="font-size:7px;color:#bbb;text-align:right;">
        ${options.shopName}
      </div>
    </div>
  `

  const allLabels = products
    .flatMap(p => Array(options.copies).fill(p))
    .map(labelHTML)
    .join('')

  const win = window.open('', '_blank', 'width=800,height=600')
  if (!win) { alert('Autorisez les popups pour imprimer les étiquettes'); return }

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Étiquettes produits</title>
  <style>
    body { margin:0; padding:10px; background:white; }
    .labels { display:flex; flex-wrap:wrap; }
    @media print {
      body { margin:0; padding:5px; }
      @page { margin:0.5cm; }
      button { display:none !important; }
    }
  </style>
</head>
<body>
  <div style="margin-bottom:10px;display:flex;gap:8px;">
    <button onclick="window.print()" style="padding:8px 16px;background:#5B4EE8;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">
      🖨️ Imprimer
    </button>
    <button onclick="window.close()" style="padding:8px 16px;background:#eee;color:#333;border:none;border-radius:8px;cursor:pointer;font-size:13px;">
      ✕ Fermer
    </button>
    <span style="font-size:12px;color:#888;align-self:center;">
      ${products.length} produit(s) × ${options.copies} copie(s) = ${products.length * options.copies} étiquette(s)
    </span>
  </div>
  <div class="labels">${allLabels}</div>
</body>
</html>`)
  win.document.close()
}

// ─── EXPORT COMPTABLE EXCEL (CSV) ────────────
export function exportAccountingExcel(
  data: { sales: any[]; expenses: any[]; period: string; shopName: string; currency: string },
  fmt: (amount: number) => string
) {
  const BOM = '﻿'
  const totalCA = data.sales.reduce((s, sale) => s + (sale.total ?? 0), 0)
  const totalExpenses = data.expenses.reduce((s, e) => s + (e.amountTTC ?? e.amount ?? 0), 0)
  const result = totalCA - totalExpenses

  const summary = [
    ['RAPPORT COMPTABLE — ' + data.shopName],
    ['Période : ' + data.period],
    ['Exporté le : ' + new Date().toLocaleDateString('fr-FR')],
    [],
    ['RÉSUMÉ'],
    ["Chiffre d'affaires total", totalCA.toFixed(2)],
    ['Total dépenses', totalExpenses.toFixed(2)],
    ['Résultat net', result.toFixed(2)],
    ['Marge brute (%)', totalCA > 0 ? ((result / totalCA) * 100).toFixed(1) + '%' : '0%'],
    [],
  ]

  const salesHeader = ['Date', 'Heure', 'Référence', 'Montant HT', 'TVA', 'Total TTC', 'Mode paiement', 'Nb articles']
  const salesRows = data.sales.map(s => {
    const date = new Date(s.createdAt)
    const ht = (s.total ?? 0) / 1.18
    const tva = (s.total ?? 0) - ht
    return [
      date.toLocaleDateString('fr-FR'),
      date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      `V-${(s.id ?? '000000').slice(-6).toUpperCase()}`,
      ht.toFixed(2),
      tva.toFixed(2),
      (s.total ?? 0).toFixed(2),
      s.paymentMode ?? 'cash',
      s.items?.length ?? 1,
    ]
  })
  const salesTotal = ['', '', 'TOTAL', (totalCA / 1.18).toFixed(2), (totalCA - totalCA / 1.18).toFixed(2), totalCA.toFixed(2), '', '']

  const expHeader = ['Date', 'Libellé', 'Catégorie', 'Montant HT', 'TVA %', 'Montant TTC', 'Mode', 'Statut']
  const expRows = data.expenses.map(e => [
    new Date(e.date).toLocaleDateString('fr-FR'),
    e.label ?? '',
    e.category ?? '',
    (e.amount ?? e.amountHT ?? 0).toFixed(2),
    (e.vat ?? 0) + '%',
    (e.amountTTC ?? Math.round((e.amount ?? 0) * (1 + (e.vat ?? 0) / 100))).toFixed(2),
    e.mode ?? '',
    e.status ?? '',
  ])
  const expTotal = ['', 'TOTAL', '', '', '', totalExpenses.toFixed(2), '', '']

  const csvLines = [
    ...summary.map(row => row.join(';')),
    ['=== VENTES ==='],
    salesHeader.join(';'),
    ...salesRows.map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')),
    salesTotal.map(c => `"${c}"`).join(';'),
    [],
    ['=== DÉPENSES ==='],
    expHeader.join(';'),
    ...expRows.map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')),
    expTotal.map(c => `"${c}"`).join(';'),
  ]

  const csv = BOM + csvLines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `HabaShop_Comptabilite_${data.period.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function htmlInfoGrid(items: { label: string; value: string }[]): string {
  return `
    <div class="info-grid">
      ${items.map(i => `
        <div class="info-item">
          <div class="info-label">${i.label}</div>
          <div class="info-value">${i.value}</div>
        </div>
      `).join('')}
    </div>
  `
}
