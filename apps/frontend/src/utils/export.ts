import JsBarcode from 'jsbarcode'
import { useAppStore, convertAmount, formatInCurrency } from '@/stores/appStore'
import { barcodeFormat, normalizeBarcode } from '@/lib/barcode'

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
  const name = escHtml(shopName || 'HabaShop')
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
      ${INVOICE_LOGO_SVG}
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

/**
 * Normalise les espaces insécables — fine U+202F (séparateur de milliers d'Intl
 * fr-FR) et classique U+00A0 — en espace simple U+0020. Les polices monospace des
 * documents d'impression (« Courier New ») n'ont pas de glyphe pour U+202F : le
 * fallback rend « 2 /800 » sur certaines plateformes. À appliquer à TOUT montant
 * interpolé dans un document imprimé (facture, devis, ticket, rapport Z).
 */
export function printableAmount(s: string): string {
  return s.replace(/[\u202F\u00A0]/g, ' ')
}

// \u00C9chappement HTML \u2014 TOUTE donn\u00E9e dynamique interpol\u00E9e dans un document
// d'impression passe par escHtml() (m\u00EAme r\u00E8gle que le rapport Ticket Z, anti-XSS :
// noms client/article/boutique = donn\u00E9es utilisateur).
function escHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;')
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
  vat:          { fr: 'TVA',           en: 'VAT',          es: 'IVA',          it: 'IVA'         }, // taux dynamique ajouté à l'usage : `${is('vat')} (X %)`
  discount:     { fr: 'Remise',        en: 'Discount',     es: 'Descuento',    it: 'Sconto'      },
  payment:      { fr: 'Mode de règlement', en: 'Payment method', es: 'Método de pago', it: 'Metodo pagamento' },
  thanks:       { fr: 'Merci de votre confiance', en: 'Thank you for your business', es: 'Gracias por su confianza', it: 'Grazie per la fiducia' },
  billed_to:      { fr: 'FACTURÉ À',      en: 'BILLED TO',           es: 'FACTURADO A',       it: 'INTESTATO A' },
  subtotal_ht:    { fr: 'Sous-total HT',  en: 'Subtotal (excl. VAT)', es: 'Subtotal (sin IVA)', it: 'Subtotale (IVA escl.)' },
  total_ttc:      { fr: 'Total TTC',      en: 'Total (incl. VAT)',    es: 'Total (IVA incl.)',  it: 'Totale (IVA incl.)' },
  status_paid:    { fr: 'Payée',          en: 'Paid',                es: 'Pagada',            it: 'Pagata' },
  status_pending: { fr: 'En attente',     en: 'Pending',             es: 'Pendiente',         it: 'In attesa' },
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
  /** Statut affiché — défaut : facture avec paymentMode → 'paid', sinon 'pending'. */
  status?: 'paid' | 'pending'
}

// Logo « Sac + H » — même dessin que components/ui/LogoMark.tsx (login/sidebar),
// décliné en SVG statique pour le document imprimé.
const INVOICE_LOGO_SVG = `<svg viewBox="0 0 100 100" width="42" height="42" role="img" aria-label="HabaShop"><rect width="100" height="100" rx="24" fill="#6C47FF"/><path d="M38 38 C38 24 62 24 62 38" fill="none" stroke="#F0A500" stroke-width="4.5" stroke-linecap="round"/><rect x="29" y="37" width="42" height="40" rx="5" fill="#fff"/><rect x="44" y="46" width="4.6" height="22" rx="1.4" fill="#6C47FF"/><rect x="52" y="46" width="4.6" height="22" rx="1.4" fill="#6C47FF"/><rect x="44" y="55" width="12.6" height="4.6" rx="1.4" fill="#6C47FF"/></svg>`

export function generateInvoice(opts: InvoiceOptions) {
  const { type, lang, customer, items, discount, paymentMode, ref, status } = opts
  const state = useAppStore.getState()
  const { currency, shopName } = state
  const tenant = state.tenant as (typeof state.tenant & { ninea?: string; rccm?: string; vatNumber?: string }) | null
  const locale = LOCALES[lang] ?? 'fr-FR'
  const now = new Date()
  const dateStr = now.toLocaleDateString(locale)
  const refStr = escHtml(ref ?? `${type === 'devis' ? 'D' : 'F'}${Date.now().toString().slice(-6)}`)
  const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(locale)

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  let discountAmt = 0
  if (discount) {
    discountAmt = discount.type === 'percent'
      ? Math.round(subtotal * discount.value / 100)
      : discount.value
  }
  const afterDiscount = subtotal - discountAmt
  const taxRatePct = state.posTaxRate ?? 18
  const tva = Math.round(afterDiscount * (taxRatePct / 100))
  const netTotal = afterDiscount + tva

  // Montants base XOF → devise tenant AVANT formatage, puis normalisation des
  // espaces insécables (U+202F rendu « / » par les polices monospace d'impression).
  const fmt = (v: number) => printableAmount(formatInCurrency(convertAmount(v, 'XOF', currency ?? 'XOF'), currency ?? 'XOF'))

  // Statut : facture réglée (paymentMode fourni ou status explicite) → « Payée » vert.
  const docStatus = status ?? (type === 'facture' && paymentMode ? 'paid' : 'pending')
  const statusPill = docStatus === 'paid'
    ? `<span style="display:inline-flex;align-items:center;gap:6px;background:#E7F7EF;color:#0E8A55;border:1px solid #BFE8D2;border-radius:999px;padding:5px 13px;font-size:11.5px;font-weight:700">● ${is('status_paid', lang)}</span>`
    : `<span style="display:inline-flex;align-items:center;gap:6px;background:#FDF3E2;color:#9A6700;border:1px solid #F0DDB4;border-radius:999px;padding:5px 13px;font-size:11.5px;font-weight:700">● ${is('status_pending', lang)}</span>`

  const itemRows = items.map(i => `
    <tr>
      <td>${i.emoji ?? '📦'} ${escHtml(i.name)}</td>
      <td style="text-align:center">${i.qty}</td>
      <td style="text-align:right;font-family:monospace">${fmt(i.price)}</td>
      <td style="text-align:right;font-family:monospace;font-weight:700">${fmt(i.price * i.qty)}</td>
    </tr>
  `).join('')

  // Mentions légales : UNIQUEMENT les identifiants réellement configurés sur le
  // tenant (jamais de faux numéros). Champs absents du modèle → ligne omise.
  const legalParts = [
    tenant?.ninea ? `NINEA ${escHtml(tenant.ninea)}` : null,
    tenant?.rccm ? `RC ${escHtml(tenant.rccm)}` : null,
    tenant?.vatNumber ? `N° TVA ${escHtml(tenant.vatNumber)}` : null,
  ].filter(Boolean)

  const totalsRow = (label: string, value: string, color = '#666') => `
    <div style="display:flex;justify-content:space-between;padding:7px 0;font-size:12px;color:${color};border-bottom:1px solid #f0f0f2">
      <span>${label}</span>
      <span style="font-family:monospace">${value}</span>
    </div>`

  const title = `${is(type, lang)} ${refStr}`
  const name = escHtml(shopName || 'HabaShop')
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
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body {
      font-family:'Geist','Geist Variable',system-ui,-apple-system,'Segoe UI',sans-serif;
      color:#1A1A2E; font-size:13px; background:#fff; padding:38px 42px;
    }
    .inv-table { width:100%; border-collapse:collapse; margin:18px 0 6px; }
    .inv-table thead th {
      color:#6C47FF; background:none; text-align:left;
      font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.6px;
      padding:9px 10px; border-bottom:2px solid #6C47FF;
    }
    .inv-table tbody td { padding:10px; border-bottom:1px solid #f0f0f2; font-size:12.5px; }
    @media print { body { padding:18px 22px; } @page { margin:1cm; size:A4; } }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:30px">
    <div style="display:flex;align-items:center;gap:13px">
      ${INVOICE_LOGO_SVG}
      <div>
        <div style="font-size:19px;font-weight:800;color:#1A1A2E;letter-spacing:-.3px">${name}</div>
        <div style="font-size:11px;color:#8A8AA3">${ps('software', lang)}</div>
      </div>
    </div>
    <div style="text-align:right">
      <div style="font-size:21px;font-weight:800;color:#6C47FF;letter-spacing:1px">${is(type, lang)}</div>
      <div style="font-family:monospace;font-size:12.5px;font-weight:700;color:#1A1A2E;margin-top:3px">N° ${refStr}</div>
      <div style="font-size:11px;color:#8A8AA3;margin-top:2px">${is('date', lang)} : ${dateStr}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:6px">
    ${customer?.name ? `<div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#8A8AA3;margin-bottom:5px">${is('billed_to', lang)}</div>
      <div style="font-size:15px;font-weight:700;color:#1A1A2E">${escHtml(customer.name)}</div>
      ${customer.phone ? `<div style="font-size:12px;color:#666;margin-top:2px">${escHtml(customer.phone)}</div>` : ''}
    </div>` : '<div></div>'}
    <div style="text-align:right">
      ${statusPill}
      ${type === 'devis'
        ? `<div style="font-size:11px;color:#8A8AA3;margin-top:6px">${is('valid_until', lang)} ${validUntil}</div>`
        : paymentMode ? `<div style="font-size:11px;color:#8A8AA3;margin-top:6px">${is('payment', lang)} : ${escHtml(paymentMode)}</div>` : ''}
    </div>
  </div>

  <table class="inv-table">
    <thead>
      <tr>
        <th>${is('description', lang)}</th>
        <th style="text-align:center;width:60px">${is('qty', lang)}</th>
        <th style="text-align:right;width:120px">${is('unit_price', lang)}</th>
        <th style="text-align:right;width:120px">${is('total', lang)}</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-top:14px">
    <div style="min-width:290px">
      ${totalsRow(is('subtotal_ht', lang), fmt(subtotal))}
      ${discountAmt > 0 ? totalsRow(`${is('discount', lang)} ${discount?.type === 'percent' ? '(' + discount.value + '%)' : ''}`, `− ${fmt(discountAmt)}`, '#059669') : ''}
      ${totalsRow(`${is('vat', lang)} (${taxRatePct} %)`, fmt(tva))}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0 0;margin-top:4px;border-top:2px solid #6C47FF">
        <span style="font-size:13.5px;font-weight:800;color:#1A1A2E">${is('total_ttc', lang)}</span>
        <span style="font-family:monospace;font-size:19px;font-weight:800;color:#6C47FF">${fmt(netTotal)}</span>
      </div>
    </div>
  </div>

  <div style="margin-top:44px;padding-top:14px;border-top:1px solid #ECECF2;text-align:center">
    ${legalParts.length ? `<div style="font-size:10.5px;color:#8A8AA3;margin-bottom:6px">${name} · ${legalParts.join(' · ')}</div>` : ''}
    <div style="font-size:12.5px;font-weight:700;color:#6C47FF">${is('thanks', lang)}</div>
  </div>

  <script>window.onload=function(){setTimeout(function(){window.print();},400);}<\/script>
</body>
</html>`)
  win.document.close()
}

// ─── ÉTIQUETTES PRODUITS ─────────────────────
export const AVERY_PRESETS = {
  L7160: {  // 63.5 x 38.1 mm — 21/page (3×7)
    label: 'Avery L7160 (21/page)',
    cols: 3, rows: 7,
    labelWidth: '63.5mm', labelHeight: '38.1mm',
    pageMarginTop: '15.1mm', pageMarginLeft: '7.21mm',
    gapX: '2.5mm', gapY: '0mm',
  },
  L7163: {  // 99.1 x 38.1 mm — 14/page (2×7)
    label: 'Avery L7163 (14/page)',
    cols: 2, rows: 7,
    labelWidth: '99.1mm', labelHeight: '38.1mm',
    pageMarginTop: '15.1mm', pageMarginLeft: '4.65mm',
    gapX: '2.5mm', gapY: '0mm',
  },
  L7165: {  // 99.1 x 67.7 mm — 8/page (2×4)
    label: 'Avery L7165 (8/page)',
    cols: 2, rows: 4,
    labelWidth: '99.1mm', labelHeight: '67.7mm',
    pageMarginTop: '13.0mm', pageMarginLeft: '4.65mm',
    gapX: '2.5mm', gapY: '0mm',
  },
  L7651: {  // 38.1 x 21.2 mm — 65/page (5×13)
    label: 'Avery L7651 (65/page)',
    cols: 5, rows: 13,
    labelWidth: '38.1mm', labelHeight: '21.2mm',
    pageMarginTop: '10.7mm', pageMarginLeft: '4.7mm',
    gapX: '2.5mm', gapY: '0mm',
  },
  CUSTOM: {  // garder le comportement actuel flex-wrap (pas d'alignement A4 strict)
    label: 'Personnalisé (sans grille)',
    cols: null, rows: null,
  },
} as const

export type AveryPreset = keyof typeof AVERY_PRESETS

// Rendu du code-barres DANS la fenêtre parente (paquet jsbarcode LOCAL, plus de
// CDN externe) → impression fiable même hors ligne. EAN-13/EAN-8 selon le code
// canonicalisé (UPC-A hérité → EAN-13) ; à défaut de code fabricant, CODE128 sur
// le SKU + badge « Code interne ». Barres NOIRES sur fond BLANC (lisibilité scanner).
function renderBarcodeMarkup(
  barcode: string | undefined,
  sku: string,
  lang: string,
  esc: (v: unknown) => string,
): string {
  const canonical = normalizeBarcode(barcode)
  const format = canonical ? barcodeFormat(canonical) : null // EAN13 | EAN8 | null
  const value = format ? canonical : (sku || '')
  const symbology = format ?? 'CODE128'
  let svg = ''
  if (value) {
    try {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      JsBarcode(el, value, { format: symbology, width: 1.5, height: 40, displayValue: true, fontSize: 10, margin: 4, background: '#FFFFFF', lineColor: '#000000' })
      svg = el.outerHTML
    } catch { svg = '' }
  }
  const internalBadge = !format
    ? `<div style="margin-top:3px;text-align:center;"><span style="display:inline-block;background:#F3F4F6;color:#6B7280;font-size:10px;border-radius:4px;padding:2px 6px;">${esc(
        lang === 'en' ? 'Internal code' : lang === 'es' ? 'Código interno' : lang === 'it' ? 'Codice interno' : 'Code interne'
      )}</span></div>`
    : ''
  return `<div style="text-align:center;border-top:1px solid #eee;padding-top:4px;">${svg}${internalBadge}</div>`
}

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
    averyPreset?: AveryPreset
  }
) {
  const SIZES = {
    small:  { w: 150, h: 80,  fontSize: 10, priceSize: 14 },
    medium: { w: 200, h: 100, fontSize: 12, priceSize: 18 },
    large:  { w: 280, h: 140, fontSize: 14, priceSize: 24 },
  }
  const s = SIZES[options.size]

  // Échappement HTML défensif (interpolations dans document.write — valeurs viennent du tenant/produits)
  const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' } as Record<string, string>)[c])

  // ── Mode d'affichage : grille Avery vs flex-wrap (custom/legacy) ──
  type GridPreset = {
    label: string
    cols: number; rows: number
    labelWidth: string; labelHeight: string
    pageMarginTop: string; pageMarginLeft: string
    gapX: string; gapY: string
  }
  const presetKey = options.averyPreset
  const useGrid = !!presetKey && presetKey !== 'CUSTOM'
  const preset: GridPreset | null = useGrid ? (AVERY_PRESETS[presetKey] as unknown as GridPreset) : null

  // En mode grille, la taille du label est imposée par le preset (mm) ; sinon px du SIZES
  const labelCellStyle = useGrid && preset
    ? `width:${preset.labelWidth}; height:${preset.labelHeight}; padding:6px; overflow:hidden; box-sizing:border-box; background:white; display:flex; flex-direction:column; justify-content:space-between; page-break-inside:avoid;`
    : `width:${s.w}px; height:${s.h}px; border:1px solid #ddd; border-radius:6px; padding:8px; margin:4px; display:inline-flex; flex-direction:column; justify-content:space-between; background:white; page-break-inside:avoid;`

  const labelHTML = (product: typeof products[0]) => {
    const barcodeBlock = options.showBarcode ? renderBarcodeMarkup(product.barcode, product.sku, options.lang, esc) : ''
    return `
    <div class="label" style="${labelCellStyle}">
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:${s.priceSize}px;">${esc(product.emoji ?? '📦')}</span>
        <div>
          <div style="font-size:${s.fontSize}px;font-weight:700;line-height:1.2;color:#1a1a2e;">
            ${esc(product.name.length > 20 ? product.name.slice(0, 20) + '...' : product.name)}
          </div>
          ${options.showSku ? `<div style="font-size:9px;color:#888;">${esc(product.sku)}</div>` : ''}
        </div>
      </div>
      ${options.showPrice ? `
        <div style="font-size:${s.priceSize}px;font-weight:900;color:#5B4EE8;">
          ${esc(fmt(product.price))}
        </div>
      ` : ''}
      ${barcodeBlock}
      <div style="font-size:7px;color:#bbb;text-align:right;">
        ${esc(options.shopName)}
      </div>
    </div>
  `
  }

  const allLabels = products
    .flatMap(p => Array(options.copies).fill(p))
    .map(labelHTML)
    .join('')

  // CSS différent selon le mode
  const gridCSS = useGrid && preset ? `
    @page { size: A4; margin: ${preset.pageMarginTop} ${preset.pageMarginLeft}; }
    body { margin:0; padding:0; background:white; }
    .labels {
      display: grid;
      grid-template-columns: repeat(${preset.cols}, ${preset.labelWidth});
      grid-auto-rows: ${preset.labelHeight};
      column-gap: ${preset.gapX};
      row-gap: ${preset.gapY};
    }
    /* Sur écran : ajouter une bordure visuelle pour preview ; cachée à l'impression */
    @media screen {
      body { padding:10mm; }
      .label { outline: 1px dashed #ccc; }
    }
    @media print {
      body { padding:0; }
      .label { outline: none; }
      button, .toolbar, .toolbar * { display:none !important; }
    }
  ` : `
    body { margin:0; padding:10px; background:white; }
    .labels { display:flex; flex-wrap:wrap; }
    @media print {
      body { margin:0; padding:5px; }
      @page { margin:0.5cm; }
      button, .toolbar, .toolbar * { display:none !important; }
    }
  `

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Autorisez les popups pour imprimer les étiquettes'); return }

  const li = (fr: string, en: string, es: string, it: string) =>
    options.lang === 'en' ? en : options.lang === 'es' ? es : options.lang === 'it' ? it : fr

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${li('Étiquettes produits', 'Product labels', 'Etiquetas de productos', 'Etichette prodotti')}</title>
  <style>${gridCSS}</style>
</head>
<body>
  <div class="toolbar" style="margin-bottom:10px;display:flex;gap:8px;align-items:center;">
    <button onclick="window.print()" style="padding:8px 16px;background:#5B4EE8;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">
      🖨️ ${li('Imprimer', 'Print', 'Imprimir', 'Stampa')}
    </button>
    <button onclick="window.close()" style="padding:8px 16px;background:#eee;color:#333;border:none;border-radius:8px;cursor:pointer;font-size:13px;">
      ✕ ${li('Fermer', 'Close', 'Cerrar', 'Chiudi')}
    </button>
    <span style="font-size:12px;color:#888;">
      ${products.length} ${li('produit(s)', 'product(s)', 'producto(s)', 'prodotto/i')} × ${options.copies} ${li('copie(s)', 'copy(ies)', 'copia(s)', 'copia/e')} = ${products.length * options.copies} ${li('étiquette(s)', 'label(s)', 'etiqueta(s)', 'etichetta/e')}${useGrid && preset ? ` — ${esc(preset.label)}` : ''}
    </span>
  </div>
  <!-- Les codes-barres sont rendus en amont (SVG inline, paquet jsbarcode local) — plus de CDN ni de script popup. -->
  <div class="labels">${allLabels}</div>
</body>
</html>`)
  win.document.close()
}

// ─── EXPORT COMPTABLE EXCEL (CSV) ────────────
// Montants stockés en base XOF → convertis vers la devise d'affichage (nombres bruts 2 déc.,
// triables/sommables dans Excel — même pattern que reportsExport.ts). En-têtes/dates localisées.
export function exportAccountingExcel(
  data: { sales: any[]; expenses: any[]; period: string; shopName: string; currency: string; lang: string },
) {
  const BOM = '﻿'
  const lang = data.lang ?? 'fr'
  const i = (fr: string, en: string, es: string, it: string) => lang === 'en' ? en : lang === 'es' ? es : lang === 'it' ? it : fr
  const loc = LOCALES[lang] ?? 'fr-FR'
  const cv = (xof: number) => Math.round(convertAmount(xof ?? 0, 'XOF', data.currency) * 100) / 100
  const totalCA = data.sales.reduce((s, sale) => s + (sale.total ?? 0), 0)
  const totalExpenses = data.expenses.reduce((s, e) => s + (e.amountTTC ?? e.amount ?? 0), 0)
  const result = totalCA - totalExpenses

  const summary = [
    [i('RAPPORT COMPTABLE', 'ACCOUNTING REPORT', 'INFORME CONTABLE', 'RAPPORTO CONTABILE') + ' — ' + data.shopName],
    [i('Période', 'Period', 'Período', 'Periodo') + ' : ' + data.period],
    [i('Exporté le', 'Exported on', 'Exportado el', 'Esportato il') + ' : ' + new Date().toLocaleDateString(loc)],
    [i('Devise', 'Currency', 'Moneda', 'Valuta') + ' : ' + data.currency],
    [],
    [i('RÉSUMÉ', 'SUMMARY', 'RESUMEN', 'RIEPILOGO')],
    [i("Chiffre d'affaires total", 'Total revenue', 'Ingresos totales', 'Ricavi totali'), cv(totalCA).toFixed(2)],
    [i('Total dépenses', 'Total expenses', 'Gastos totales', 'Spese totali'), cv(totalExpenses).toFixed(2)],
    [i('Résultat net', 'Net result', 'Resultado neto', 'Risultato netto'), cv(result).toFixed(2)],
    [i('Marge brute (%)', 'Gross margin (%)', 'Margen bruto (%)', 'Margine lordo (%)'), totalCA > 0 ? ((result / totalCA) * 100).toFixed(1) + '%' : '0%'],
    [],
  ]

  const salesHeader = [
    i('Date', 'Date', 'Fecha', 'Data'), i('Heure', 'Time', 'Hora', 'Ora'), i('Référence', 'Reference', 'Referencia', 'Riferimento'),
    i('Montant HT', 'Amount excl. tax', 'Importe sin IVA', 'Importo netto'), i('TVA', 'VAT', 'IVA', 'IVA'),
    i('Total TTC', 'Total incl. tax', 'Total con IVA', 'Totale lordo'),
    i('Mode paiement', 'Payment method', 'Método de pago', 'Metodo di pagamento'), i('Nb articles', 'Items', 'Artículos', 'Articoli'),
  ]
  const salesRows = data.sales.map(s => {
    const date = new Date(s.createdAt)
    const _vatDivisor = 1 + (useAppStore.getState().posTaxRate ?? 18) / 100
    const ht = (s.total ?? 0) / _vatDivisor
    const tva = (s.total ?? 0) - ht
    return [
      date.toLocaleDateString(loc),
      date.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }),
      `V-${(s.id ?? '000000').slice(-6).toUpperCase()}`,
      cv(ht).toFixed(2),
      cv(tva).toFixed(2),
      cv(s.total ?? 0).toFixed(2),
      s.paymentMode ?? 'cash',
      s.items?.length ?? 1,
    ]
  })
  const _salesVatDiv = 1 + (useAppStore.getState().posTaxRate ?? 18) / 100
  const salesTotal = ['', '', 'TOTAL', cv(totalCA / _salesVatDiv).toFixed(2), cv(totalCA - totalCA / _salesVatDiv).toFixed(2), cv(totalCA).toFixed(2), '', '']

  const expHeader = [
    i('Date', 'Date', 'Fecha', 'Data'), i('Libellé', 'Label', 'Concepto', 'Descrizione'), i('Catégorie', 'Category', 'Categoría', 'Categoria'),
    i('Montant HT', 'Amount excl. tax', 'Importe sin IVA', 'Importo netto'), i('TVA %', 'VAT %', 'IVA %', 'IVA %'),
    i('Montant TTC', 'Amount incl. tax', 'Importe con IVA', 'Importo lordo'),
    i('Mode', 'Method', 'Modo', 'Modo'), i('Statut', 'Status', 'Estado', 'Stato'),
  ]
  const expRows = data.expenses.map(e => [
    new Date(e.date).toLocaleDateString(loc),
    e.label ?? '',
    e.category ?? '',
    cv(e.amount ?? e.amountHT ?? 0).toFixed(2),
    (e.vat ?? 0) + '%',
    cv(e.amountTTC ?? Math.round((e.amount ?? 0) * (1 + (e.vat ?? 0) / 100))).toFixed(2),
    e.mode ?? '',
    e.status ?? '',
  ])
  const expTotal = ['', 'TOTAL', '', '', '', cv(totalExpenses).toFixed(2), '', '']

  const csvLines = [
    ...summary.map(row => row.join(';')),
    [`=== ${i('VENTES', 'SALES', 'VENTAS', 'VENDITE')} ===`],
    salesHeader.join(';'),
    ...salesRows.map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')),
    salesTotal.map(c => `"${c}"`).join(';'),
    [],
    [`=== ${i('DÉPENSES', 'EXPENSES', 'GASTOS', 'SPESE')} ===`],
    expHeader.join(';'),
    ...expRows.map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')),
    expTotal.map(c => `"${c}"`).join(';'),
  ]

  const csv = BOM + csvLines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const shopSlug = (data.shopName || 'HabaShop').replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '')
  a.href     = url
  a.download = `${shopSlug}_${i('Comptabilite', 'Accounting', 'Contabilidad', 'Contabilita')}_${data.period.replace(/\s/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── CAHIER DES CHARGES PDF ───────────────────
export function generateCDC() {
  const { shopName } = useAppStore.getState()
  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR')
  const version = 'v2.0'

  const modules = [
    { id: 'M01', name: 'Point de Vente (POS)', desc: 'Encaissement rapide, catalogue filtrable, multi-modes de paiement (espèces, mobile money, Wave, Orange Money, carte), ticket imprimable ou WhatsApp, mode offline PWA.', status: 'Livré' },
    { id: 'M02', name: 'Gestion des Stocks', desc: "CRUD produits avec photo/emoji, alertes rupture configurables, bon de commande automatique, historique des mouvements, export CSV.", status: 'Livré' },
    { id: 'M03', name: 'Tableau de Bord', desc: "KPIs temps réel (CA, ventes, stock, RH), graphiques recharts interactifs, alertes critiques, activité récente.", status: 'Livré' },
    { id: 'M04', name: 'CRM Clients', desc: "Fiches clients, catégories (gros/semi-gros/fidèle), programme de fidélité, historique des achats, import/export CSV.", status: 'Livré' },
    { id: 'M05', name: 'Fournisseurs & Commandes', desc: "Fiches fournisseurs, bons de commande PDF, suivi des livraisons, balance fournisseur.", status: 'Livré' },
    { id: 'M06', name: 'Rapports & Analytics', desc: "Rapports par période, donut paiements, top produits, marges, exports PDF/CSV. Support multi-devises.", status: 'Livré' },
    { id: 'M07', name: 'RH & Équipe', desc: "Fiches employés, contrats CDI/CDD, salaires, planning hebdomadaire, gestion des congés, présences.", status: 'Livré' },
    { id: 'M08', name: 'Planning & Pointage', desc: "Planning hebdomadaire visuel, drag & drop, statuts de présence (présent/retard/absent/congé).", status: 'Livré' },
    { id: 'M09', name: 'Paie', desc: "Bulletin de paie PDF, cotisations CNSS/IPRES configurables, avances sur salaire, export comptable.", status: 'Livré' },
    { id: 'M10', name: 'Dépenses', desc: "Gestion des dépenses par catégorie, TVA, statut de paiement, export comptable Excel/CSV.", status: 'Livré' },
    { id: 'M11', name: 'Prévisions & Objectifs', desc: "Bons de commande fournisseurs, prévisions de stock, alertes de réapprovisionnement.", status: 'Livré' },
    { id: 'M12', name: 'Marketing & SMS', desc: "Campagnes SMS/WhatsApp en masse, segmentation clients, suivi des envois.", status: 'Livré' },
    { id: 'M13', name: 'Intelligence Artificielle', desc: "Assistant IA Claude Sonnet, analyse financière, conseils business, chat conversationnel.", status: 'Livré' },
    { id: 'M14', name: 'Notifications Push', desc: "Alertes stock, confirmations de vente, rappels RH via l'API Web Push + Service Worker PWA.", status: 'Livré' },
    { id: 'M15', name: 'Gestion des Utilisateurs', desc: "RBAC granulaire, rôles (admin/manager/caissier), authentification JWT, session timeout.", status: 'Livré' },
    { id: 'M16', name: 'API REST & Intégrations', desc: "API Fastify documentée, authentification Bearer JWT, webhooks, support Swagger/OpenAPI.", status: 'Livré' },
  ]

  const techStack = [
    { cat: 'Frontend',   items: 'React 18, TypeScript, Vite, Zustand (persist), Recharts, React Router v6' },
    { cat: 'CSS',        items: "CSS Variables design system, Plus Jakarta Sans, JetBrains Mono, PWA (Service Worker)" },
    { cat: 'Backend',    items: 'Node.js 20, Fastify 4, Prisma ORM, PostgreSQL, JWT Auth, Zod validation' },
    { cat: 'Infra',      items: 'Railway (backend), Vercel (frontend), GitHub CI/CD, Sentry (logs)' },
    { cat: 'Devises',    items: 'XOF, XAF, EUR, USD, CAD — conversion en temps réel' },
    { cat: 'Langues',    items: 'Français, English, Español, Italiano — i18n complet' },
  ]

  const modulesHTML = modules.map(m => `
    <tr>
      <td style="font-family:monospace;font-weight:700;color:#5B4EE8">${m.id}</td>
      <td style="font-weight:700">${m.name}</td>
      <td style="font-size:11px;color:#555">${m.desc}</td>
      <td><span class="badge badge-green">${m.status}</span></td>
    </tr>
  `).join('')

  const techHTML = techStack.map(t => `
    <tr>
      <td style="font-weight:700;color:#5B4EE8;width:120px">${t.cat}</td>
      <td style="font-size:12px">${t.items}</td>
    </tr>
  `).join('')

  const body = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Modules</div>
        <div class="kpi-value">16</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Stack technique</div>
        <div class="kpi-value">React + Fastify</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Version</div>
        <div class="kpi-value">${version}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Date</div>
        <div class="kpi-value">${dateStr}</div>
      </div>
    </div>

    <h2>1. Présentation du logiciel</h2>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Nom du produit</div>
        <div class="info-value">HabaShop ${version}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Boutique configurée</div>
        <div class="info-value">${shopName || 'HabaShop Demo'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Type de solution</div>
        <div class="info-value">SaaS — Logiciel de gestion commerciale</div>
      </div>
      <div class="info-item">
        <div class="info-label">Cible principale</div>
        <div class="info-value">Commerces africains (TPE / PME)</div>
      </div>
      <div class="info-item">
        <div class="info-label">Déploiement</div>
        <div class="info-value">Web + PWA (offline-ready)</div>
      </div>
      <div class="info-item">
        <div class="info-label">API publique</div>
        <div class="info-value">REST — Bearer JWT — Swagger</div>
      </div>
    </div>

    <h2>2. Modules fonctionnels (${modules.length} livrés)</h2>
    <table>
      <thead>
        <tr><th>ID</th><th>Module</th><th>Description</th><th>Statut</th></tr>
      </thead>
      <tbody>${modulesHTML}</tbody>
    </table>

    <h2>3. Stack technique</h2>
    <table>
      <thead>
        <tr><th>Catégorie</th><th>Technologies</th></tr>
      </thead>
      <tbody>${techHTML}</tbody>
    </table>

    <h2>4. Architecture</h2>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Pattern frontend</div>
        <div class="info-value">SPA — React 18 + Zustand + React Router v6</div>
      </div>
      <div class="info-item">
        <div class="info-label">Pattern backend</div>
        <div class="info-value">REST API — Fastify + Prisma + PostgreSQL</div>
      </div>
      <div class="info-item">
        <div class="info-label">Authentification</div>
        <div class="info-value">JWT Bearer — localStorage — 2FA TOTP</div>
      </div>
      <div class="info-item">
        <div class="info-label">Offline / PWA</div>
        <div class="info-value">Service Worker — Cache First assets, Network First API</div>
      </div>
      <div class="info-item">
        <div class="info-label">Multi-devises</div>
        <div class="info-value">XOF base — conversion temps réel (EUR/USD/CAD/XAF)</div>
      </div>
      <div class="info-item">
        <div class="info-label">Internationalisation</div>
        <div class="info-value">i18n complet — fr/en/es/it — store Zustand persist</div>
      </div>
    </div>

    <h2>5. Sécurité & conformité</h2>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Chiffrement</div>
        <div class="info-value">HTTPS obligatoire — JWT signé HS256</div>
      </div>
      <div class="info-item">
        <div class="info-label">RBAC</div>
        <div class="info-value">Rôles admin / manager / caissier — permissions granulaires</div>
      </div>
      <div class="info-item">
        <div class="info-label">Journalisation</div>
        <div class="info-value">Journal d'audit immuable — toutes les actions critiques</div>
      </div>
      <div class="info-item">
        <div class="info-label">Données</div>
        <div class="info-value">Hébergement Europe — RGPD — backups quotidiens</div>
      </div>
    </div>

    <div class="signature-block">
      <div class="signature-line">Responsable technique</div>
      <div class="signature-line">Responsable boutique</div>
    </div>
  `

  openPDF(`HabaShop — Cahier des Charges ${version}`, body)
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
