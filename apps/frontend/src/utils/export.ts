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
