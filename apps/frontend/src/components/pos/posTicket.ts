import { t, formatInCurrency } from '@/stores/appStore'
import type { Currency } from '@/stores/appStore'
import type { CartItem } from './posShared'

interface PrintTicketParams {
  lang: string
  locale: string
  cart: CartItem[]
  discount: { type:'percent'|'amount'; value:number; reason:string } | null
  discountAmount: number
  totalHT: number
  tva: number
  posTaxRate: number
  total: number
  payMode: 'cash'|'card'|'wave'|'orange'|'mobile'
  cashGiven: string
  currency: Currency
  monnaie: number
  fmt: (n: number) => string
  // Paiement mixte (split) — montants base XOF ; si fourni, remplace la ligne paiement unique.
  mixed?: { cashAmount: number; mobileMoneyAmount: number; cardAmount: number } | null
}

// Ouvre une fenêtre d'impression avec le ticket de caisse formaté (80mm).
export function printTicket(p: PrintTicketParams) {
  const { lang, locale, cart, discount, discountAmount, totalHT, tva, posTaxRate, total, payMode, cashGiven, currency, monnaie, fmt, mixed } = p
  const mLabel = (m: 'cash'|'mobile'|'card') => m === 'cash' ? t('pos_cash') : m === 'card' ? t('pos_card') : t('pos_mobile')
  // Bloc paiement : mixte (2 lignes) si fourni, sinon ligne unique + reçu/monnaie.
  const paymentRows = mixed
    ? [
        (mixed.cashAmount > 0 ? `<div class="row"><span>${mLabel('cash')}</span><span>${fmt(mixed.cashAmount)}</span></div>` : ''),
        (mixed.mobileMoneyAmount > 0 ? `<div class="row"><span>${mLabel('mobile')}</span><span>${fmt(mixed.mobileMoneyAmount)}</span></div>` : ''),
        (mixed.cardAmount > 0 ? `<div class="row"><span>${mLabel('card')}</span><span>${fmt(mixed.cardAmount)}</span></div>` : ''),
      ].join('')
    : `<div class="row" style="margin-top:6px;"><span>${t('pos_ticket_payment')}</span><span>${payMode === 'cash' ? t('pos_cash') : payMode === 'card' ? t('pos_card') : t('pos_mobile')}</span></div>` +
      (cashGiven ? `
    <div class="row"><span>${t('pos_ticket_received')}</span><span>${formatInCurrency(parseFloat(cashGiven), currency)}</span></div>
    <div class="row bold"><span>${t('pos_ticket_change')}</span><span>${fmt(Math.max(monnaie, 0))}</span></div>
  ` : '')
  const win = window.open('', '_blank', 'width=400,height=600')
  if (!win) return
  const now = new Date()
  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <title>${t('pos_print_ticket')}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Courier New',monospace; font-size:12px; color:#000; padding:10px; max-width:300px; margin:0 auto; }
    .center { text-align:center; }
    .bold { font-weight:bold; }
    .big { font-size:16px; font-weight:900; }
    .divider { border-top:1px dashed #000; margin:8px 0; }
    .row { display:flex; justify-content:space-between; margin:4px 0; }
    .total { font-size:15px; font-weight:900; }
    .footer { margin-top:12px; font-size:10px; }
    @media print { @page { size:80mm auto; margin:0; } }
  </style>
</head>
<body>
  <div class="center">
    <div class="big">HabaShop</div>
    <div style="font-size:10px;color:#555;">${t('pos_ticket_subtitle')}</div>
  </div>
  <div class="divider"></div>
  <div class="row"><span>${t('pos_ticket_date')}</span><span>${now.toLocaleDateString(locale)}</span></div>
  <div class="row"><span>${t('pos_ticket_time')}</span><span>${now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span></div>
  <div class="row"><span>${t('pos_ticket_cashier_label')}</span><span>${t('pos_cashier')} 1</span></div>
  <div class="row"><span>${t('pos_ticket_number')}</span><span>#V${Date.now().toString().slice(-6)}</span></div>
  <div class="divider"></div>
  <div class="bold" style="margin-bottom:6px;">${t('pos_ticket_articles')}</div>
  ${cart.map(item => `
    <div class="row">
      <span style="flex:1;">${item.name}</span>
      <span style="margin:0 8px;">x${item.qty}</span>
      <span>${fmt(item.price * item.qty)}</span>
    </div>
  `).join('')}
  <div class="divider"></div>
  ${discount && discountAmount > 0 ? (() => { const remise = lang === 'en' ? 'Discount' : lang === 'es' ? 'Descuento' : lang === 'it' ? 'Sconto' : 'Remise'; return `<div class="row" style="color:green;font-weight:bold;"><span>${discount.type === 'percent' ? `${remise} (${discount.value} %)` : remise} :</span><span>− ${fmt(discountAmount)}</span></div>` })() : ''}
  <div class="row"><span>${t('pos_subtotal')} :</span><span>${fmt(Math.round(totalHT))}</span></div>
  <div class="row"><span>${t('pos_vat')} (${posTaxRate} %) :</span><span>${fmt(Math.round(tva))}</span></div>
  <div class="divider"></div>
  <div class="row total"><span>${t('pos_total')} :</span><span>${fmt(total)}</span></div>
  ${mixed ? `<div class="row" style="margin-top:6px;"><span>${t('pos_ticket_payment')}</span><span></span></div>` : ''}
  ${paymentRows}
  <div class="divider"></div>
  <div class="center footer">
    <div>${t('pos_ticket_thanks')}</div>
    <div style="margin-top:4px;">${t('pos_ticket_keep')}</div>
    <div style="margin-top:8px;font-size:9px;">HabaShop — ${now.toLocaleDateString(locale)}</div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();window.close();},300);}<\/script>
</body>
</html>`
  win.document.write(html)
  win.document.close()
}
