import { useState, useEffect } from 'react'
import { useAppStore, useFormatAmount, formatCurrency, t, convertAmount, formatInCurrency } from '@/stores/appStore'
import type { Currency } from '@/stores/appStore'
import { salesApi, productsApi, whatsappApi } from '@/lib/api'
import BarcodeScanner from '@/components/ui/BarcodeScanner'
import { generateInvoice } from '@/utils/export'
import { Search, Minus, Plus, Trash2, ShoppingCart, X } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── DONNÉES ───────────────────────────────
const CATS = [
  { id: 'all',     label: 'Tous' },
  { id: 'cereals', label: 'Céréales' },
  { id: 'fat',     label: 'Corps gras' },
  { id: 'grocery', label: 'Épicerie' },
  { id: 'hygiene', label: 'Hygiène' },
  { id: 'dairy',   label: 'Laitiers' },
  { id: 'canned',  label: 'Conserves' },
]

const PRODUCTS = [
  { id:1,  name:'Riz parfumé 5kg',        price:4500,  priceWholesale:3800, priceSemiWholesale:4100, cat:'cereals', emoji:'🌾', stock:120, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:2,  name:'Huile palme 1L',          price:1800,  priceWholesale:1400, priceSemiWholesale:1600, cat:'fat',     emoji:'🫙', stock:18,  promotion:true,  promotionPrice:1500, promotionEnd:'2026-05-31' },
  { id:3,  name:'Sucre 1kg',               price:850,   priceWholesale:700,  priceSemiWholesale:780,  cat:'grocery', emoji:'🍚', stock:245, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:4,  name:'Farine blé 1kg',          price:650,   priceWholesale:520,  priceSemiWholesale:590,  cat:'cereals', emoji:'🌾', stock:89,  promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:5,  name:'Savon OMO 500g',          price:500,   priceWholesale:380,  priceSemiWholesale:430,  cat:'hygiene', emoji:'🧼', stock:150, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:6,  name:'Lait poudre 400g',        price:2200,  priceWholesale:1800, priceSemiWholesale:2000, cat:'dairy',   emoji:'🥛', stock:67,  promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:7,  name:'Tomate conc. 800g',       price:1400,  priceWholesale:1100, priceSemiWholesale:1250, cat:'canned',  emoji:'🍅', stock:112, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:8,  name:'Huile végétale 5L',       price:8500,  priceWholesale:7000, priceSemiWholesale:7800, cat:'fat',     emoji:'🫒', stock:34,  promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:9,  name:'Café soluble 200g',       price:2800,  priceWholesale:2200, priceSemiWholesale:2500, cat:'grocery', emoji:'☕', stock:55,  promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:10, name:'Sardines 155g',           price:900,   priceWholesale:700,  priceSemiWholesale:800,  cat:'canned',  emoji:'🐟', stock:200, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:11, name:'Savon ménage 400g',       price:350,   priceWholesale:270,  priceSemiWholesale:310,  cat:'hygiene', emoji:'🫧', stock:180, promotion:false, promotionPrice:0,    promotionEnd:'' },
  { id:12, name:'Lait concentré 397g',     price:1100,  priceWholesale:880,  priceSemiWholesale:990,  cat:'dairy',   emoji:'🥤', stock:95,  promotion:false, promotionPrice:0,    promotionEnd:'' },
]

type PosProduct = typeof PRODUCTS[0] & { id: number | string }

interface CartItem {
  id: number | string
  name: string
  price: number
  qty: number
  emoji: string
}

// ─── TEXTES CAISSE i18n ─────────────────────
const CASHIER_TEXTS = {
  fr: {
    closed_title: 'Caisse fermée',
    closed_sub: 'Ouvrez la caisse pour commencer les ventes.',
    fund_label: 'Fond de caisse initial',
    fund_placeholder: 'Ex: 50 000',
    cashier_label: 'Caisse 1',
    open_btn: '🔓 Ouvrir la caisse',
    close_btn: '🔒 Fermer',
    close_title: 'Fermeture de caisse',
    open_time: 'Heure ouverture',
    close_time: 'Heure fermeture',
    initial_fund: 'Fond de caisse',
    transactions: 'Transactions',
    ca_cashed: 'CA encaissé',
    total_cash: 'Total en caisse',
    counted_label: 'Montant compté en caisse',
    counted_placeholder: 'Entrez le montant physique compté...',
    confirm_close: '🔒 Confirmer la fermeture',
    cancel: 'Annuler',
    opened_on: 'Caisse ouverte le',
  },
  en: {
    closed_title: 'Cash register closed',
    closed_sub: 'Open the register to start sales.',
    fund_label: 'Opening float',
    fund_placeholder: 'Ex: 50,000',
    cashier_label: 'Register 1',
    open_btn: '🔓 Open register',
    close_btn: '🔒 Close',
    close_title: 'Close register',
    open_time: 'Opening time',
    close_time: 'Closing time',
    initial_fund: 'Opening float',
    transactions: 'Transactions',
    ca_cashed: 'Revenue',
    total_cash: 'Total in register',
    counted_label: 'Counted amount',
    counted_placeholder: 'Enter the physically counted amount...',
    confirm_close: '🔒 Confirm closing',
    cancel: 'Cancel',
    opened_on: 'Register opened on',
  },
  es: {
    closed_title: 'Caja cerrada',
    closed_sub: 'Abra la caja para comenzar las ventas.',
    fund_label: 'Fondo de caja inicial',
    fund_placeholder: 'Ej: 50,000',
    cashier_label: 'Caja 1',
    open_btn: '🔓 Abrir caja',
    close_btn: '🔒 Cerrar',
    close_title: 'Cierre de caja',
    open_time: 'Hora apertura',
    close_time: 'Hora cierre',
    initial_fund: 'Fondo inicial',
    transactions: 'Transacciones',
    ca_cashed: 'Ingresos',
    total_cash: 'Total en caja',
    counted_label: 'Importe contado',
    counted_placeholder: 'Ingrese el importe contado físicamente...',
    confirm_close: '🔒 Confirmar cierre',
    cancel: 'Cancelar',
    opened_on: 'Caja abierta el',
  },
  it: {
    closed_title: 'Cassa chiusa',
    closed_sub: 'Apri la cassa per iniziare le vendite.',
    fund_label: 'Fondo cassa iniziale',
    fund_placeholder: 'Es: 50.000',
    cashier_label: 'Cassa 1',
    open_btn: '🔓 Apri cassa',
    close_btn: '🔒 Chiudi',
    close_title: 'Chiusura cassa',
    open_time: 'Ora apertura',
    close_time: 'Ora chiusura',
    initial_fund: 'Fondo iniziale',
    transactions: 'Transazioni',
    ca_cashed: 'Incasso',
    total_cash: 'Totale in cassa',
    counted_label: 'Importo contato',
    counted_placeholder: 'Inserire l\'importo contato fisicamente...',
    confirm_close: '🔒 Conferma chiusura',
    cancel: 'Annulla',
    opened_on: 'Cassa aperta il',
  },
}

// ─── COMPOSANT ─────────────────────────────
export default function POS() {
  const {
    lang, currency,
    cashierOpen, cashierOpenedAt,
    cashierOpeningFund, cashierSessionTx, cashierSessionCA,
    openCashier, closeCashier, addCashierSale,
    posTaxRate, posShowStockOnTile, posDefaultFund,
    posDefaultPayment, priceMode,
    enableScanner: posEnableScanner, autoWhatsApp: posAutoWhatsApp,
  } = useAppStore()
  const fmt = useFormatAmount()
  const LOCALE_MAP: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT' }
  const locale = LOCALE_MAP[lang] ?? 'fr-FR'
  const ct = CASHIER_TEXTS[lang as keyof typeof CASHIER_TEXTS] ?? CASHIER_TEXTS.fr
  const currencySymbol = ({ XOF:'FCFA', XAF:'FCFA', EUR:'€', USD:'$', CAD:'CA$' } as Record<string, string>)[currency as string] ?? 'FCFA'

  const [posProducts, setPosProducts] = useState<PosProduct[]>(PRODUCTS)

  useEffect(() => {
    productsApi.list()
      .then(data => setPosProducts(data.map((p: any): PosProduct => ({
        id: p.id,
        name: p.name,
        price: p.sellPrice ?? 0,
        priceWholesale: p.wholesalePrice ?? p.sellPrice ?? 0,
        priceSemiWholesale: p.semiWholesalePrice ?? p.sellPrice ?? 0,
        cat: (p.category || 'grocery').toLowerCase().replace(/[éè]/g, 'e').replace(/\s+/g, ''),
        emoji: p.emoji || '📦',
        stock: p.stockQty ?? 0,
        promotion: p.hasPromotion ?? false,
        promotionPrice: p.promotionPrice ?? 0,
        promotionEnd: p.promotionEnd?.split('T')[0] ?? '',
      }))))
      .catch(() => {})
  }, [])

  const [cart, setCart]           = useState<CartItem[]>([])
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch]       = useState('')
  const [payMode, setPayMode]     = useState<'cash'|'card'|'wave'|'orange'|'mobile'>(() => (posDefaultPayment ?? 'cash') as 'cash'|'card'|'wave'|'orange'|'mobile')
  useEffect(() => { setPayMode((posDefaultPayment ?? 'cash') as 'cash'|'card'|'wave'|'orange'|'mobile') }, [posDefaultPayment])
  const [customerPhone, setCustomerPhone] = useState('')
  const [sendWhatsApp, setSendWhatsApp]   = useState(() => posAutoWhatsApp)
  const [sendingWA, setSendingWA]         = useState(false)
  const [cashGiven, setCashGiven] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [clientType, setClientType] = useState<'retail'|'wholesale'|'semi'>('retail')
  const [discount, setDiscount] = useState<{ type:'percent'|'amount'; value:number; reason:string } | null>(null)
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountForm, setDiscountForm] = useState({ type:'percent' as 'percent'|'amount', value:0, reason:'' })
  const [isSaving, setIsSaving] = useState(false)
  const [posTab, setPosTab] = useState<'pos'|'history'>('pos')
  const [salesHistory, setSalesHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products')

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const data = await salesApi.list()
      setSalesHistory(data ?? [])
    } catch {
      setSalesHistory([{
        id:'1', createdAt: new Date().toISOString(),
        total:45000, paymentMode:'cash',
        items:[{qty:2, unitPrice:4500, total:9000, product:{name:'Riz parfumé 5kg'}}],
      }])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleScan = (barcode: string) => {
    setShowScanner(false)
    const found = PRODUCTS.find(p =>
      p.name.toLowerCase().includes(barcode.toLowerCase()) ||
      String(p.id) === barcode
    )
    if (found) {
      addItem(found)
      toast.success(`📦 ${found.name} scanné`)
    } else {
      toast.error(`Produit non trouvé: ${barcode}`)
    }
  }

  // ─── CAISSE (état local uniquement pour l'input) ─
  const [openingFundInput, setOpeningFundInput] = useState(() => posDefaultFund > 0 ? String(posDefaultFund) : '')
  const [showCloseModal, setShowCloseModal]     = useState(false)

  // Fond de caisse : l'input est dans la devise configurée, stockage direct
  const inputValue  = parseFloat(openingFundInput) || 0
  const displayFund = formatInCurrency(inputValue, currency)
  const fundPreview = null

  // Prix selon type client
  const getPrice = (p: PosProduct) => {
    if (clientType === 'wholesale') return p.priceWholesale
    if (clientType === 'semi')      return p.priceSemiWholesale
    return p.promotion ? p.promotionPrice || p.price : p.price
  }

  // Filtrage produits
  const filtered = posProducts.filter(p =>
    (activeCat === 'all' || p.cat === activeCat) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // Actions panier
  const addItem = (p: PosProduct) => {
    const price = getPrice(p)
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: p.id, name: p.name, price, qty: 1, emoji: p.emoji }]
    })
  }

  const updateQty = (id: number | string, delta: number) => {
    setCart(prev =>
      prev.map(i => i.id === id ? { ...i, qty: i.qty + delta } : i)
          .filter(i => i.qty > 0)
    )
  }

  const removeItem = (id: number | string) => setCart(prev => prev.filter(i => i.id !== id))

  // Calculs
  const VAT_RATE = posTaxRate / 100
  const subtotalBeforeDiscount = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discountAmount = discount
    ? discount.type === 'percent'
      ? subtotalBeforeDiscount * discount.value / 100
      : Math.min(discount.value, subtotalBeforeDiscount)
    : 0
  const total   = subtotalBeforeDiscount - discountAmount
  const totalHT = total / (1 + VAT_RATE)
  const tva     = total - totalHT
  const cashGivenAmount = parseFloat(cashGiven) || 0
  const monnaie = cashGivenAmount - total

  const PAY_MODES = [
    { id: 'cash',   label: t('pos_cash'),                                    icon: '💵', color: '#10B981' },
    { id: 'card',   label: t('pos_card'),                                    icon: '💳', color: '#5B4EE8' },
    { id: 'wave',   label: 'Wave',                                           icon: '🌊', color: '#1B9AF5' },
    { id: 'orange', label: 'Orange Money',                                   icon: '🟠', color: '#FF6600' },
    { id: 'mobile', label: lang === 'fr' ? 'Autre mobile' : 'Other mobile', icon: '📲', color: '#F59E0B' },
  ] as { id: 'cash'|'card'|'wave'|'orange'|'mobile'; label: string; icon: string; color: string }[]

  const printTicket = () => {
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
  ${discount && discountAmount > 0 ? `<div class="row" style="color:green;font-weight:bold;"><span>${discount.type === 'percent' ? `Remise (${discount.value} %)` : 'Remise'} :</span><span>− ${fmt(discountAmount)}</span></div>` : ''}
  <div class="row"><span>${t('pos_subtotal')} :</span><span>${fmt(Math.round(totalHT))}</span></div>
  <div class="row"><span>${t('pos_vat')} (${posTaxRate} %) :</span><span>${fmt(Math.round(tva))}</span></div>
  <div class="divider"></div>
  <div class="row total"><span>${t('pos_total')} :</span><span>${fmt(total)}</span></div>
  <div class="row" style="margin-top:6px;"><span>${t('pos_ticket_payment')}</span><span>${payMode === 'cash' ? t('pos_cash') : payMode === 'card' ? t('pos_card') : t('pos_mobile')}</span></div>
  ${cashGiven ? `
    <div class="row"><span>${t('pos_ticket_received')}</span><span>${formatInCurrency(parseFloat(cashGiven), currency)}</span></div>
    <div class="row bold"><span>${t('pos_ticket_change')}</span><span>${formatInCurrency(Math.max(monnaie, 0), currency)}</span></div>
  ` : ''}
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

  const confirmSale = async () => {
    setIsSaving(true)
    try {
      await salesApi.create({
        items: cart.map(i => ({
          productId: /^\d+$/.test(String(i.id))
            ? `demo-PRD-${String(i.id).padStart(3, '0')}`
            : String(i.id),
          qty: i.qty,
          price: i.price,
        })),
        paymentMode: payMode,
        total,
        discount: discount ? { type: discount.type, amount: discountAmount } : null,
      })
    } catch {
      // Hors-ligne : la vente est quand même enregistrée localement
    }

    // Envoi WhatsApp si activé
    if (sendWhatsApp && customerPhone) {
      setSendingWA(true)
      try {
        const ticketRef = `V${Date.now().toString().slice(-6)}`
        await whatsappApi.sendTicket({
          phone: customerPhone,
          ticket: {
            ref: ticketRef,
            items: cart.map(item => ({ name: item.name, qty: item.qty, total: Math.round(item.price * item.qty) })),
            total: Math.round(total),
            paymentMode: payMode === 'cash' ? (lang === 'fr' ? 'Espèces' : 'Cash')
              : payMode === 'card' ? (lang === 'fr' ? 'Carte' : 'Card')
              : payMode === 'wave' ? 'Wave'
              : payMode === 'orange' ? 'Orange Money' : 'Mobile',
          },
          shopName: 'HabaShop — Dakar Central',
          lang,
        })
        toast.success('📱 Ticket WhatsApp envoyé !')
      } catch {
        toast.error('❌ Échec envoi WhatsApp')
      } finally {
        setSendingWA(false)
      }
    }

    addCashierSale(total)
    toast.success('✅ Vente encaissée !')
    setCart([])
    setShowModal(false)
    setCashGiven('')
    setDiscount(null)
    setSendWhatsApp(false)
    setCustomerPhone('')
    setIsSaving(false)
  }

  // ─── RENDER ──────────────────────────────

  if (!cashierOpen) {
    return (
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'center',
        height:'calc(100vh - 54px)', background:'var(--bg)',
      }}>
        <div style={{
          background:'var(--card)', border:'1px solid var(--border)',
          borderRadius:20, padding:'40px 48px',
          maxWidth:480, width:'100%', textAlign:'center',
          boxShadow:'0 20px 60px rgba(0,0,0,.3)',
        }}>
          <div style={{
            width:80, height:80, borderRadius:'50%',
            background:'rgba(91,78,232,.12)', border:'2px solid rgba(91,78,232,.25)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:36, margin:'0 auto 20px',
          }}>🔐</div>
          <h2 style={{ fontSize:22, fontWeight:900, color:'var(--text)', marginBottom:8, letterSpacing:'-0.5px' }}>
            {ct.closed_title}
          </h2>
          <p style={{ fontSize:13, color:'var(--text2)', marginBottom:28, lineHeight:1.6 }}>
            {ct.closed_sub}
          </p>
          <div style={{ marginBottom:20, textAlign:'left' }}>
            <label style={{
              display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'.5px', color:'var(--text3)', marginBottom:6,
            }}>{ct.fund_label}</label>
            <div style={{ position:'relative' }}>
              <input
                className="input"
                type="number"
                placeholder={ct.fund_placeholder}
                value={openingFundInput}
                onChange={e => setOpeningFundInput(e.target.value)}
                style={{ fontSize:16, textAlign:'right', paddingRight:60 }}
              />
              <span style={{
                position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                fontSize:12, fontWeight:700, color:'var(--text3)',
              }}>{currencySymbol}</span>
            </div>
            {openingFundInput && (
              <div style={{ marginTop:6, fontSize:12, color:'var(--acc2)', fontFamily:'var(--mono)', fontWeight:600 }}>
                {fundPreview ?? displayFund}
              </div>
            )}
          </div>
          <div style={{
            padding:'12px 16px', borderRadius:10,
            background:'var(--bg3)', border:'1px solid var(--border)',
            display:'flex', alignItems:'center', gap:12,
            marginBottom:24, textAlign:'left',
          }}>
            <div style={{
              width:36, height:36, borderRadius:'50%',
              background:'linear-gradient(135deg,var(--p),var(--p2))',
              display:'flex', alignItems:'center', justifyContent:'center',
              color:'#fff', fontSize:14, fontWeight:800, flexShrink:0,
            }}>N</div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Nelson Djoumessi</div>
              <div style={{ fontSize:11, color:'var(--text3)' }}>
                {ct.cashier_label} · {new Date().toLocaleDateString(locale, { weekday:'long', day:'numeric', month:'long' })}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              openCashier(inputValue)
              toast.success(`✅ ${ct.cashier_label} ouverte — Fond: ${displayFund}`)
            }}
            style={{
              width:'100%',
              background:'linear-gradient(135deg,var(--p),var(--p2))',
              border:'none', borderRadius:12, padding:'14px',
              fontSize:15, fontWeight:800, color:'#fff',
              cursor:'pointer', fontFamily:'var(--font)',
              boxShadow:'0 6px 20px rgba(91,78,232,.4)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}
          >{ct.open_btn}</button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* PAGE WRAPPER */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        height: 'calc(100vh - 54px)',
        overflow: 'hidden',
        background: 'var(--bg)',
        gap: 0,
      }}>

        {/* Mobile nav bar */}
        {isMobile && (
          <div style={{
            display: 'flex',
            flexShrink: 0,
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)',
          }}>
            {(['products', 'cart'] as const).map(view => (
              <button
                key={view}
                onClick={() => setMobileView(view)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  background: 'none',
                  border: 'none',
                  borderBottom: mobileView === view ? '3px solid var(--p)' : '3px solid transparent',
                  color: mobileView === view ? 'var(--p)' : 'var(--text3)',
                  fontWeight: mobileView === view ? 800 : 500,
                  fontSize: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {view === 'products' ? `🛒 ${t('pos_products') || 'Produits'}` : `🛍️ ${t('pos_cart')} (${cart.length})`}
              </button>
            ))}
          </div>
        )}

        {/* ════════════════════════════════
            COLONNE GAUCHE — CATALOGUE
        ════════════════════════════════ */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: isMobile && mobileView === 'cart' ? 'none' : 'flex',
          flexDirection: 'column',
          padding: '12px 12px 12px 16px',
          gap: 10,
          overflow: 'hidden',
        }}>

          {/* Onglets Caisse / Historique */}
          <div style={{
            display: 'flex', gap: 4,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 12, padding: 5,
            flexShrink: 0,
          }}>
            {([
              { id:'pos',     label: lang === 'fr' ? '🛒 Caisse'     : lang === 'en' ? '🛒 Register'  : lang === 'es' ? '🛒 Caja'      : '🛒 Cassa'   },
              { id:'history', label: lang === 'fr' ? '📋 Historique' : lang === 'en' ? '📋 History'   : lang === 'es' ? '📋 Historial' : '📋 Storico' },
            ] as const).map(tab => (
              <button key={tab.id} type="button"
                onClick={() => { setPosTab(tab.id); if (tab.id === 'history') fetchHistory() }}
                style={{
                  flex:1, padding:'8px', borderRadius:8,
                  fontSize:13, fontWeight:600,
                  cursor:'pointer', fontFamily:'var(--font)',
                  background: posTab === tab.id ? 'linear-gradient(135deg,var(--p),var(--p2))' : 'transparent',
                  color: posTab === tab.id ? '#fff' : 'var(--text2)',
                  border:'none', transition:'all .15s',
                }}
              >{tab.label}</button>
            ))}
          </div>

          {/* Filtres catégories */}
          {posTab === 'pos' && (
            <div style={{
              flexShrink: 0,
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              flexWrap: 'nowrap',
              paddingBottom: 2,
            }}>
              {CATS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font)',
                    transition: 'all .15s',
                    border: 'none',
                    whiteSpace: 'nowrap',
                    background: activeCat === c.id
                      ? 'linear-gradient(135deg, var(--p), var(--p2))'
                      : 'var(--bg3)',
                    color: activeCat === c.id ? '#fff' : 'var(--text2)',
                    boxShadow: activeCat === c.id ? '0 4px 14px rgba(91,78,232,.35)' : 'none',
                  }}
                >{c.id === 'all' ? t('pos_all') : c.label}</button>
              ))}
            </div>
          )}

          {/* Recherche + Scan */}
          {posTab === 'pos' && (
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{
                  position: 'absolute', left: 10,
                  top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text3)', pointerEvents: 'none',
                }} />
                <input
                  className="input"
                  style={{ paddingLeft: 34, width: '100%', fontSize: 13, boxSizing: 'border-box' }}
                  placeholder={t('pos_search')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              {posEnableScanner && (
                <button
                  onClick={() => setShowScanner(true)}
                  title="Scanner un code-barres"
                  style={{
                    width: 40, height: 40, borderRadius: 10, fontSize: 18,
                    cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
                    background: 'var(--bg3)', border: '1px solid var(--border)',
                    color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >📷</button>
              )}
            </div>
          )}

          {/* Barre type client + remise */}
          {posTab === 'pos' && <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {([
              { id:'retail',    label:'Détail',   icon:'👤' },
              { id:'wholesale', label:'Grossiste', icon:'🏭' },
              { id:'semi',      label:'Demi-gros', icon:'📦' },
            ] as { id:'retail'|'wholesale'|'semi'; label:string; icon:string }[]).map(ct => (
              <button key={ct.id} onClick={() => setClientType(ct.id)} style={{
                padding:'6px 12px', borderRadius:8, fontSize:12, fontWeight:600,
                cursor:'pointer', fontFamily:'var(--font)', transition:'all .15s',
                background: clientType === ct.id ? 'rgba(91,78,232,.2)' : 'var(--bg3)',
                border:`1px solid ${clientType === ct.id ? 'var(--p2)' : 'var(--border)'}`,
                color: clientType === ct.id ? 'var(--p2)' : 'var(--text2)',
                display:'flex', alignItems:'center', gap:5,
              }}><span>{ct.icon}</span>{ct.label}</button>
            ))}
            <div style={{ width:1, height:20, background:'var(--border)', margin:'0 4px' }} />
            <button onClick={() => setShowDiscountModal(true)} style={{
              padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:600,
              cursor:'pointer', fontFamily:'var(--font)', transition:'all .15s',
              background: discount ? 'rgba(14,196,126,.15)' : 'var(--bg3)',
              border:`1px solid ${discount ? 'rgba(14,196,126,.3)' : 'var(--border)'}`,
              color: discount ? 'var(--acc2)' : 'var(--text2)',
              display:'flex', alignItems:'center', gap:6,
            }}>
              🏷️ {discount
                ? `Remise: ${discount.type === 'percent' ? discount.value + ' %' : fmt(discount.value)}`
                : 'Appliquer une remise'}
            </button>
            {discount && (
              <button onClick={() => setDiscount(null)} style={{
                padding:'6px 8px', borderRadius:8, fontSize:11,
                background:'rgba(232,64,74,.1)', border:'1px solid rgba(232,64,74,.2)',
                color:'var(--danger)', cursor:'pointer', fontFamily:'var(--font)',
              }}>✕ Annuler remise</button>
            )}
            <div style={{ marginLeft:'auto', fontSize:11, color:'var(--acc)', fontWeight:600 }}>
              🏷️ {PRODUCTS.filter(p => p.promotion).length} promotions actives
            </div>
          </div>}

          {/* Grille produits — SCROLL ICI */}
          {posTab === 'pos' && <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            paddingTop: 8,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 10,
              paddingBottom: 8,
            }}>
              {filtered.map(p => {
                const inCart     = cart.find(i => i.id === p.id)
                const isLowStock = p.stock < 20
                return (
                  <div
                    key={p.id}
                    onClick={() => addItem(p)}
                    style={{
                      background: inCart
                        ? 'linear-gradient(135deg, rgba(91,78,232,.15), rgba(124,111,240,.08))'
                        : 'var(--card)',
                      border: inCart
                        ? '1.5px solid var(--p2)'
                        : '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '16px 12px 14px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all .18s',
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    onMouseEnter={e => {
                      if (!inCart) {
                        const el = e.currentTarget as HTMLElement
                        el.style.borderColor = 'var(--p2)'
                        el.style.transform = 'translateY(-2px)'
                        el.style.boxShadow = '0 8px 24px rgba(91,78,232,.18)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!inCart) {
                        const el = e.currentTarget as HTMLElement
                        el.style.borderColor = 'var(--border)'
                        el.style.transform = 'none'
                        el.style.boxShadow = 'none'
                      }
                    }}
                  >
                    {/* Badge promo */}
                    {p.promotion && clientType === 'retail' && (
                      <div style={{
                        position:'absolute', top:6, left:6,
                        background:'var(--danger)', color:'#fff',
                        borderRadius:6, padding:'2px 6px',
                        fontSize:9, fontWeight:800,
                      }}>PROMO</div>
                    )}
                    {/* Badge quantité si dans panier */}
                    {inCart && (
                      <div style={{
                        position: 'absolute',
                        top: -8, right: -8,
                        background: 'var(--p)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: 22, height: 22,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11, fontWeight: 800,
                        border: '2px solid var(--bg)',
                      }}>×{inCart.qty}</div>
                    )}

                    {/* Emoji dans cercle */}
                    <div style={{
                      width: 56, height: 56,
                      borderRadius: '50%',
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                    }}>{p.emoji}</div>

                    {/* Nom */}
                    <div style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--text)',
                      lineHeight: 1.3,
                    }}>{p.name}</div>

                    {/* Prix */}
                    {clientType !== 'retail' && (
                      <div style={{ fontSize:9, color:'var(--text3)', textDecoration:'line-through', fontFamily:'var(--mono)' }}>
                        {fmt(p.price)}
                      </div>
                    )}
                    {p.promotion && clientType === 'retail' && (
                      <div style={{ fontSize:9, color:'var(--text3)', textDecoration:'line-through', fontFamily:'var(--mono)' }}>
                        {fmt(p.price)}
                      </div>
                    )}
                    <div style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: p.promotion && clientType === 'retail' ? 'var(--danger)' : 'var(--acc)',
                      fontFamily: 'var(--mono)',
                    }}>{fmt(getPrice(p))}</div>

                    {/* Stock */}
                    {posShowStockOnTile && (
                      <div style={{
                        fontSize: 10.5,
                        color: isLowStock ? 'var(--danger)' : 'var(--text3)',
                        fontWeight: isLowStock ? 600 : 400,
                      }}>
                        {isLowStock ? '⚠️ ' : ''}Stock : {p.stock}
                      </div>
                    )}
                  </div>
                )
              })}

              {filtered.length === 0 && (
                <div style={{
                  gridColumn: '1 / -1',
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: 'var(--text3)',
                  fontSize: 14,
                }}>
                  {t('pos_not_found')}
                </div>
              )}
            </div>
          </div>}

          {/* ── Onglet Historique ── */}
          {posTab === 'history' && (
            <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
              {loadingHistory ? (
                <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
                  ⏳ {lang === 'fr' ? 'Chargement...' : 'Loading...'}
                </div>
              ) : salesHistory.length === 0 ? (
                <div style={{ textAlign:'center', padding:40, color:'var(--text3)' }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
                  <div>{lang === 'fr' ? 'Aucune vente enregistrée' : lang === 'en' ? 'No sales recorded' : lang === 'es' ? 'Sin ventas registradas' : 'Nessuna vendita registrata'}</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'0 4px' }}>
                  {salesHistory.slice(0, 50).map((sale: any, i: number) => {
                    const date = new Date(sale.createdAt)
                    const timeAgo = Math.round((Date.now() - date.getTime()) / 60000)
                    const timeLabel = timeAgo < 60 ? `${timeAgo} min` : `${Math.round(timeAgo / 60)}h`
                    return (
                      <div key={sale.id ?? i} style={{
                        background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12, padding:'12px 14px',
                      }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                          <div>
                            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginBottom:2 }}>
                              💳 {lang === 'fr' ? 'Vente' : lang === 'en' ? 'Sale' : lang === 'es' ? 'Venta' : 'Vendita'} #{String(sale.id).slice(-6).toUpperCase()}
                            </div>
                            <div style={{ fontSize:11, color:'var(--text3)' }}>
                              {date.toLocaleDateString(lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-US' : lang === 'es' ? 'es-ES' : 'it-IT')}
                              {' · '}{date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
                              {' · '}{timeLabel}
                            </div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:15, fontWeight:900, color:'var(--p2)', fontFamily:'var(--mono)' }}>{fmt(sale.total)}</div>
                            <span style={{
                              fontSize:10, fontWeight:700, borderRadius:20, padding:'2px 8px',
                              background: sale.paymentMode === 'cash' ? 'rgba(14,196,126,.12)' : sale.paymentMode === 'card' ? 'rgba(91,78,232,.12)' : 'rgba(240,165,0,.12)',
                              color: sale.paymentMode === 'cash' ? 'var(--acc2)' : sale.paymentMode === 'card' ? 'var(--p2)' : 'var(--acc)',
                            }}>
                              {sale.paymentMode === 'cash' ? (lang === 'fr' ? 'Espèces' : 'Cash')
                                : sale.paymentMode === 'card' ? (lang === 'fr' ? 'Carte' : 'Card') : 'Mobile'}
                            </span>
                          </div>
                        </div>
                        {sale.items?.slice(0, 3).map((item: any, j: number) => (
                          <div key={j} style={{
                            fontSize:11, color:'var(--text2)',
                            display:'flex', justifyContent:'space-between',
                            padding: j === 0 ? '8px 0 3px' : '3px 0',
                            borderTop: j === 0 ? '1px solid var(--border)' : 'none',
                            marginTop: j === 0 ? 6 : 0,
                          }}>
                            <span>×{item.qty} {item.product?.name ?? 'Produit'}</span>
                            <span style={{ fontFamily:'var(--mono)' }}>{fmt(item.total ?? item.qty * item.unitPrice)}</span>
                          </div>
                        ))}
                        {sale.items?.length > 3 && (
                          <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
                            +{sale.items.length - 3} {lang === 'fr' ? 'autres articles' : 'more items'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Séparateur vertical */}
        {!isMobile && (
          <div style={{ width: 1, background: 'var(--border)', margin: '12px 0', flexShrink: 0 }} />
        )}

        {/* ════════════════════════════════
            COLONNE DROITE — PANIER
        ════════════════════════════════ */}
        <div style={{
          width: isMobile ? '100%' : 320,
          flexShrink: 0,
          display: isMobile && mobileView === 'products' ? 'none' : 'flex',
          flexDirection: 'column',
          padding: isMobile ? 0 : '12px 16px 12px 12px',
          overflow: 'hidden',
        }}>

          {/* Cart card */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: isMobile ? 0 : 14,
            overflow: 'hidden',
          }}>

          {/* ── HEADER PANIER UNIQUE ── */}
          <div style={{
            flexShrink: 0,
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg,rgba(91,78,232,.1),rgba(124,111,240,.05))',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg,var(--p),var(--p2))',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 16,
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(108,71,255,.4)',
            }}>🛒</div>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', flex: 1 }}>
              {lang === 'fr' ? 'Panier' : lang === 'en' ? 'Cart' : lang === 'es' ? 'Carrito' : 'Carrello'}
            </span>
            {cart.length > 0 && (
              <span style={{
                background: 'var(--p)',
                color: '#fff', borderRadius: 20,
                padding: '2px 8px', fontSize: 11,
                fontWeight: 800, fontFamily: 'var(--mono)',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {cart.reduce((s, i) => s + i.qty, 0)}{' '}
                {lang === 'fr' ? 'art.' : 'items'}
              </span>
            )}
            {cashierSessionTx > 0 && (
              <span style={{
                background: 'rgba(0,208,132,.15)',
                border: '1px solid rgba(0,208,132,.25)',
                color: 'var(--acc2)', borderRadius: 20,
                padding: '3px 10px', fontSize: 11,
                fontWeight: 700, fontFamily: 'var(--mono)',
                display: 'flex', alignItems: 'center', gap: 4,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--acc2)',
                  boxShadow: '0 0 6px var(--acc2)',
                }}/>
                {cashierSessionTx} tx
              </span>
            )}
            {cart.length > 0 && (
              <button type="button"
                onClick={() => { if (window.confirm(lang === 'fr' ? 'Vider le panier ?' : 'Clear cart?')) setCart([]) }}
                title={lang === 'fr' ? 'Vider le panier' : 'Clear cart'}
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: 'rgba(232,64,74,.1)', border: '1px solid rgba(232,64,74,.2)',
                  cursor: 'pointer', fontSize: 12, color: 'var(--danger)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all .15s', flexShrink: 0,
                }}>🗑</button>
            )}
            <button type="button" onClick={() => setShowCloseModal(true)} style={{
              fontSize: 11, color: 'var(--danger)',
              background: 'rgba(232,64,74,.1)', border: '1px solid rgba(232,64,74,.2)',
              borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
              fontFamily: 'var(--font)', fontWeight: 700, flexShrink: 0,
              whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>🔒 {lang === 'fr' ? 'Fermer' : 'Close'}</button>
          </div>

          {/* ── LISTE ITEMS — ZONE SCROLLABLE ── */}
          <div style={{
            flexGrow: 1, flexShrink: 1, flexBasis: '0px',
            overflowY: 'auto', overflowX: 'hidden', minHeight: 0,
          }}>
            {cart.length === 0 ? (
              <div style={{
                display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', height:'100%', color:'var(--text3)',
                gap:10, padding:20,
              }}>
                <div style={{
                  width:60, height:60, borderRadius:'50%',
                  border:'2px dashed var(--border)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:26,
                }}>🛒</div>
                <div style={{ fontSize:13, fontWeight:600, textAlign:'center', color:'var(--text2)' }}>
                  {lang === 'fr' ? 'Panier vide' : lang === 'en' ? 'Empty cart' : lang === 'es' ? 'Carrito vacío' : 'Carrello vuoto'}
                </div>
                <div style={{ fontSize:11, color:'var(--text3)', textAlign:'center' }}>
                  {lang === 'fr' ? 'Cliquez sur un produit' : lang === 'en' ? 'Click on a product' : lang === 'es' ? 'Haga clic en un producto' : 'Clicca su un prodotto'}
                </div>
              </div>
            ) : (
              <div style={{ padding:'6px 8px' }}>
                {cart.map((item, idx) => (
                  <div key={item.id} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'9px 10px',
                    borderBottom: idx < cart.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                    borderRadius:10, transition:'background .1s',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(91,78,232,.06)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div style={{
                      width:36, height:36, borderRadius:10,
                      background:'linear-gradient(135deg,rgba(91,78,232,.12),rgba(124,111,240,.08))',
                      border:'1px solid rgba(91,78,232,.15)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:18, flexShrink:0,
                    }}>{item.emoji ?? '📦'}</div>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{
                        fontSize:12, fontWeight:700, color:'var(--text)', lineHeight:1.3,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      }}>{item.name}</div>
                      <div style={{ fontSize:10, color:'var(--text3)', marginTop:1, fontFamily:'var(--mono)' }}>
                        {fmt(item.price)} / unité
                      </div>
                    </div>

                    <div style={{
                      display:'flex', alignItems:'center', gap:3, flexShrink:0,
                      background:'var(--bg3)', border:'1px solid var(--border)',
                      borderRadius:8, padding:3,
                    }}>
                      <button type="button"
                        onClick={() => updateQty(item.id, -1)}
                        style={{
                          width:22, height:22, borderRadius:6,
                          background: item.qty === 1 ? 'rgba(232,64,74,.2)' : 'transparent',
                          border:'none', cursor:'pointer', fontSize:12,
                          color: item.qty === 1 ? 'var(--danger)' : 'var(--text2)',
                          display:'flex', alignItems:'center', justifyContent:'center', transition:'all .1s',
                        }}>
                        {item.qty === 1 ? '×' : '−'}
                      </button>
                      <span style={{
                        fontSize:13, fontWeight:900, color:'var(--text)',
                        fontFamily:'var(--mono)', minWidth:20, textAlign:'center', lineHeight:1,
                      }}>{item.qty}</span>
                      <button type="button"
                        onClick={() => updateQty(item.id, +1)}
                        style={{
                          width:22, height:22, borderRadius:6,
                          background:'var(--p)', border:'none', cursor:'pointer',
                          fontSize:14, color:'#fff',
                          display:'flex', alignItems:'center', justifyContent:'center', transition:'all .1s',
                          boxShadow:'0 2px 6px rgba(91,78,232,.3)',
                        }}>+</button>
                    </div>

                    <div style={{
                      fontSize:13, fontWeight:900, color:'var(--p2)',
                      fontFamily:'var(--mono)', minWidth:62, textAlign:'right', flexShrink:0,
                    }}>{fmt(item.price * item.qty)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── TOTAUX ── */}
          {cart.length > 0 && (
            <div style={{
              flexShrink:0, padding:'10px 14px',
              borderTop:'1px solid var(--border)',
              background:'linear-gradient(180deg,var(--bg3),var(--bg4))',
            }}>
              {discount && discountAmount > 0 && (
                <div style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'4px 8px', marginBottom:6,
                  background:'rgba(14,196,126,.08)', border:'1px solid rgba(14,196,126,.15)',
                  borderRadius:8,
                }}>
                  <span style={{ fontSize:11, color:'var(--acc2)', fontWeight:600 }}>
                    🏷️ {lang === 'fr' ? 'Remise' : 'Discount'}{discount.type === 'percent' ? ` ${discount.value}%` : ''}
                  </span>
                  <span style={{ fontSize:11, fontWeight:800, color:'var(--acc2)', fontFamily:'var(--mono)' }}>
                    − {fmt(discountAmount)}
                  </span>
                </div>
              )}
              <div style={{
                display:'flex', justifyContent:'space-between',
                fontSize:10, color:'var(--text3)', marginBottom:6, padding:'0 2px',
              }}>
                <span>HT : <span style={{ fontFamily:'var(--mono)' }}>{fmt(Math.round(totalHT))}</span></span>
                <span>TVA {posTaxRate}% : <span style={{ fontFamily:'var(--mono)' }}>{fmt(Math.round(tva))}</span></span>
              </div>
              <div style={{
                display:'flex', justifyContent:'space-between', alignItems:'center',
                padding:'8px 10px',
                background:'rgba(91,78,232,.08)', border:'1px solid rgba(91,78,232,.15)',
                borderRadius:10,
              }}>
                <span style={{ fontSize:11, fontWeight:800, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'.5px' }}>TOTAL TTC</span>
                <span style={{ fontSize:26, fontWeight:900, color:'var(--p2)', fontFamily:'var(--mono)', letterSpacing:'-1px' }}>{fmt(total)}</span>
              </div>
            </div>
          )}

          {/* ── MODES PAIEMENT — 5 colonnes ── */}
          <div style={{ flexShrink: 0, padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4, marginBottom: 6 }}>
              {PAY_MODES.map(mode => (
                <button key={mode.id} type="button" onClick={() => setPayMode(mode.id)}
                  style={{
                    padding: '6px 2px', borderRadius: 8, fontSize: 9, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'var(--font)',
                    background: payMode === mode.id ? `${mode.color}20` : 'var(--bg3)',
                    border: `1.5px solid ${payMode === mode.id ? mode.color : 'var(--border)'}`,
                    color: payMode === mode.id ? mode.color : 'var(--text3)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, transition: 'all .12s',
                  }}>
                  <span style={{ fontSize: 14 }}>{mode.icon}</span>
                  {mode.label}
                </button>
              ))}
            </div>

            {payMode === 'cash' && (
              <div style={{ marginTop:6 }}>
                <div style={{ position:'relative' }}>
                  <input className="input" type="number"
                    placeholder={lang === 'fr' ? 'Montant reçu...' : 'Amount received...'}
                    value={cashGiven} onChange={e => setCashGiven(e.target.value)}
                    style={{ textAlign:'right', paddingRight:50, fontSize:13 }}
                  />
                  <span style={{
                    position:'absolute', right:12, top:'50%',
                    transform:'translateY(-50%)',
                    fontSize:11, fontWeight:700, color:'var(--text3)',
                    pointerEvents:'none',
                  }}>{currencySymbol}</span>
                </div>
                {cashGiven && parseFloat(cashGiven) > 0 && (
                  <div style={{
                    marginTop:6, display:'flex', justifyContent:'space-between',
                    alignItems:'center', fontSize:13, padding:'8px 12px',
                    background: monnaie >= 0 ? 'rgba(0,208,132,.08)' : 'rgba(255,59,92,.08)',
                    border:`1px solid ${monnaie >= 0 ? 'rgba(0,208,132,.2)' : 'rgba(255,59,92,.2)'}`,
                    borderRadius:10,
                  }}>
                    <span style={{ color:'var(--text2)', fontWeight:600 }}>
                      {lang === 'fr' ? 'Monnaie à rendre' : 'Change'}
                    </span>
                    <span style={{ fontWeight:900, fontFamily:'var(--mono)', fontSize:16, color: monnaie >= 0 ? 'var(--acc2)' : 'var(--danger)' }}>
                      {monnaie >= 0
                        ? formatInCurrency(monnaie, currency)
                        : `− ${formatInCurrency(Math.abs(monnaie), currency)}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {(payMode === 'wave' || payMode === 'orange') && cart.length > 0 && (
              <div style={{
                marginTop:6, padding:'8px 10px',
                background: payMode === 'wave' ? 'rgba(27,154,245,.08)' : 'rgba(255,102,0,.08)',
                border:`1px solid ${payMode === 'wave' ? 'rgba(27,154,245,.25)' : 'rgba(255,102,0,.25)'}`,
                borderRadius:8, textAlign:'center',
              }}>
                <div style={{ fontSize:14, fontWeight:800, color: payMode === 'wave' ? '#1B9AF5' : '#FF6600', marginBottom:6 }}>
                  {fmt(total)}
                </div>
                <button type="button"
                  onClick={() => {
                    toast.success(lang === 'fr'
                      ? `✅ ${payMode === 'wave' ? 'Wave' : 'Orange Money'} confirmé !`
                      : `✅ ${payMode === 'wave' ? 'Wave' : 'Orange Money'} confirmed!`)
                    confirmSale()
                  }}
                  style={{
                    background: payMode === 'wave' ? '#1B9AF5' : '#FF6600',
                    border:'none', borderRadius:7, padding:'7px 16px',
                    fontSize:12, fontWeight:700, color:'#fff',
                    cursor:'pointer', fontFamily:'var(--font)',
                  }}>
                  ✅ {lang === 'fr' ? 'Confirmer' : 'Confirm'}
                </button>
              </div>
            )}
          </div>

          {/* ── BOUTON ENCAISSER ── */}
          <div style={{ flexShrink:0, padding:'8px 10px', borderTop:'1px solid var(--border)' }}>
            <button type="button"
              disabled={cart.length === 0}
              onClick={() => cart.length ? setShowModal(true) : toast.error(lang === 'fr' ? 'Panier vide !' : 'Empty cart!')}
              style={{
                width:'100%', padding:'13px',
                background: cart.length === 0 ? 'var(--bg4)' : 'linear-gradient(135deg,var(--p),var(--p2))',
                border:'none', borderRadius:11, fontSize:14, fontWeight:800,
                color: cart.length === 0 ? 'var(--text3)' : '#fff',
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                fontFamily:'var(--font)',
                boxShadow: cart.length === 0 ? 'none' : '0 4px 16px rgba(91,78,232,.4)',
                transition:'all .2s',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              }}>
              {cart.length === 0
                ? (lang === 'fr' ? '🛒 Panier vide' : '🛒 Empty cart')
                : `✅ ${lang === 'fr' ? 'Encaisser' : lang === 'en' ? 'Checkout' : lang === 'es' ? 'Cobrar' : 'Incassare'} — ${fmt(total)}`}
            </button>
            {cashierSessionTx > 0 && (
              <div style={{
                display:'flex', justifyContent:'space-between',
                fontSize:10, color:'var(--text3)', marginTop:5, padding:'0 4px',
              }}>
                <span>📊 {cashierSessionTx} tx</span>
                <span style={{ color:'var(--acc)', fontFamily:'var(--mono)', fontWeight:600 }}>{fmt(cashierSessionCA)}</span>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════
          MODAL REMISE
      ════════════════════════════════ */}
      {showDiscountModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setShowDiscountModal(false)}>
          <div className="modal-box" style={{ maxWidth:420 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:800, color:'var(--text)' }}>🏷️ Appliquer une remise</h3>
              <button className="mini-btn" onClick={() => setShowDiscountModal(false)}>✕</button>
            </div>

            {/* Type */}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:8 }}>Type de remise</label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {([
                  { type:'percent', label:'Pourcentage (%)', icon:'%' },
                  { type:'amount',  label:'Montant fixe',    icon:'F' },
                ] as { type:'percent'|'amount'; label:string; icon:string }[]).map(rt => (
                  <button key={rt.type} onClick={() => setDiscountForm(f => ({...f, type:rt.type}))} style={{
                    padding:'12px', borderRadius:10, cursor:'pointer', fontFamily:'var(--font)',
                    fontSize:13, fontWeight:600, transition:'all .15s',
                    background: discountForm.type === rt.type ? 'rgba(91,78,232,.15)' : 'var(--bg3)',
                    border:`1.5px solid ${discountForm.type === rt.type ? 'var(--p2)' : 'var(--border)'}`,
                    color: discountForm.type === rt.type ? 'var(--p2)' : 'var(--text2)',
                    display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                  }}>
                    <span style={{ fontSize:22, fontWeight:900 }}>{rt.icon}</span>
                    {rt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Remises rapides % */}
            {discountForm.type === 'percent' && (
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:8 }}>Remise rapide</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {[5,10,15,20,25,30].map(pct => (
                    <button key={pct} onClick={() => setDiscountForm(f => ({...f, value:pct}))} style={{
                      padding:'7px 14px', borderRadius:8, fontSize:13, fontWeight:700,
                      cursor:'pointer', fontFamily:'var(--font)', border:'none', transition:'all .15s',
                      background: discountForm.value === pct ? 'var(--p)' : 'var(--bg3)',
                      color: discountForm.value === pct ? '#fff' : 'var(--text2)',
                    }}>{pct} %</button>
                  ))}
                </div>
              </div>
            )}

            {/* Valeur personnalisée */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
                {discountForm.type === 'percent' ? 'Pourcentage personnalisé' : 'Montant de la remise'}
              </label>
              <div style={{ position:'relative' }}>
                <input className="input" type="number"
                  placeholder={discountForm.type === 'percent' ? 'Ex: 12' : 'Ex: 5000'}
                  value={discountForm.value || ''}
                  onChange={e => setDiscountForm(f => ({...f, value:+e.target.value}))}
                  style={{ paddingRight:50 }} />
                <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', fontSize:13, fontWeight:700, color:'var(--text3)' }}>
                  {discountForm.type === 'percent' ? '%' : 'F'}
                </span>
              </div>
              {discountForm.value > 0 && (
                <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(14,196,126,.08)', border:'1px solid rgba(14,196,126,.2)', borderRadius:8, fontSize:12, display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--text2)' }}>Remise sur {fmt(subtotalBeforeDiscount)}</span>
                  <span style={{ color:'var(--acc2)', fontWeight:700, fontFamily:'var(--mono)' }}>
                    − {discountForm.type === 'percent'
                      ? fmt(subtotalBeforeDiscount * discountForm.value / 100)
                      : fmt(discountForm.value)}
                  </span>
                </div>
              )}
            </div>

            {/* Motif */}
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>Motif (optionnel)</label>
              <input className="input" placeholder="Ex: Client fidèle, promotion du jour..."
                value={discountForm.reason}
                onChange={e => setDiscountForm(f => ({...f, reason:e.target.value}))} />
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button className="topbar-btn" style={{ flex:1, justifyContent:'center' }}
                onClick={() => {
                  if (!discountForm.value) { toast.error('Entrez une valeur'); return }
                  if (discountForm.type === 'percent' && discountForm.value > 100) { toast.error('Max 100 %'); return }
                  setDiscount(discountForm)
                  setShowDiscountModal(false)
                  toast.success(`🏷️ Remise de ${discountForm.type === 'percent' ? discountForm.value + ' %' : fmt(discountForm.value)} appliquée`)
                }}>
                ✅ Appliquer la remise
              </button>
              <button className="mini-btn" style={{ padding:'10px 16px' }} onClick={() => setShowDiscountModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          MODAL CONFIRMATION
      ════════════════════════════════ */}
      {/* ════════════════════════════════
          MODAL FERMETURE CAISSE
      ════════════════════════════════ */}
      {showCloseModal && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setShowCloseModal(false)}>
          <div className="modal-box" style={{ maxWidth:480 }}>
            <h3 style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:20 }}>
              {ct.close_title}
            </h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
              {[
                { label: ct.open_time,    value: cashierOpenedAt ? new Date(cashierOpenedAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}) : '--:--' },
                { label: ct.close_time,   value: new Date().toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}) },
                { label: ct.initial_fund, value: fmt(cashierOpeningFund) },
                { label: ct.transactions, value: String(cashierSessionTx) },
                { label: ct.ca_cashed,    value: fmt(cashierSessionCA) },
                { label: ct.total_cash,   value: fmt(cashierOpeningFund + cashierSessionCA) },
              ].map(s => (
                <div key={s.label} style={{
                  background:'var(--bg3)', border:'1px solid var(--border)',
                  borderRadius:10, padding:'10px 14px',
                }}>
                  <div style={{ fontSize:10, color:'var(--text3)', marginBottom:4, textTransform:'uppercase', letterSpacing:'.5px' }}>{s.label}</div>
                  <div style={{ fontSize:14, fontWeight:800, color:'var(--text)', fontFamily:'var(--mono)' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
                {ct.counted_label}
              </label>
              <input className="input" type="number"
                placeholder={ct.counted_placeholder}
                id="counted-amount"
                style={{ fontSize:14 }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => {
                  // counted et expected sont dans la devise configurée
                  const counted = parseFloat((document.getElementById('counted-amount') as HTMLInputElement)?.value || '0')
                  const expected = cashierOpeningFund + cashierSessionCA
                  const diff = counted - expected
                  const openedTime = cashierOpenedAt ? new Date(cashierOpenedAt).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}) : '--:--'
                  const win = window.open('', '_blank', 'width=400,height=600')
                  if (win) {
                    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${ct.close_title}</title>
                    <style>body{font-family:'Courier New',monospace;font-size:12px;padding:20px;max-width:300px;margin:0 auto;}
                    .center{text-align:center;}.bold{font-weight:bold;}.big{font-size:16px;font-weight:900;}
                    .divider{border-top:1px dashed #000;margin:8px 0;}.row{display:flex;justify-content:space-between;margin:4px 0;}
                    .ok{color:green;}.err{color:red;}</style></head><body>
                    <div class="center"><div class="big">HabaShop</div><div>${ct.close_title.toUpperCase()}</div>
                    <div>${ct.cashier_label} — ${new Date().toLocaleDateString(locale)}</div></div>
                    <div class="divider"></div>
                    <div class="row"><span>${ct.open_time}:</span><span>${openedTime}</span></div>
                    <div class="row"><span>${ct.close_time}:</span><span>${new Date().toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})}</span></div>
                    <div class="row"><span>Caissier:</span><span>Nelson D.</span></div>
                    <div class="divider"></div>
                    <div class="row"><span>${ct.initial_fund}:</span><span>${fmt(cashierOpeningFund)}</span></div>
                    <div class="row"><span>${ct.transactions}:</span><span>${cashierSessionTx}</span></div>
                    <div class="row bold"><span>${ct.ca_cashed}:</span><span>${fmt(cashierSessionCA)}</span></div>
                    <div class="divider"></div>
                    <div class="row bold"><span>Attendu:</span><span>${fmt(expected)}</span></div>
                    <div class="row bold"><span>${ct.counted_label.split(' ')[0]}:</span><span>${formatInCurrency(counted, currency)}</span></div>
                    <div class="row bold ${diff >= 0 ? 'ok' : 'err'}"><span>Écart:</span><span>${diff >= 0 ? '+' : ''}${formatInCurrency(Math.abs(diff), currency)}</span></div>
                    <div class="divider"></div>
                    <div class="center" style="margin-top:20px;"><div>________________________</div><div>Signature caissier</div></div>
                    <script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},300)}<\/script>
                    </body></html>`)
                    win.document.close()
                  }
                  closeCashier()
                  setOpeningFundInput('')
                  setShowCloseModal(false)
                  toast.success('✅ Caisse fermée — Rapport imprimé')
                }}
                className="topbar-btn"
                style={{ flex:1, justifyContent:'center', background:'linear-gradient(135deg,var(--danger),#dc2626)' }}
              >{ct.confirm_close}</button>
              <button className="mini-btn" style={{ padding:'10px 16px' }}
                onClick={() => setShowCloseModal(false)}>{ct.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="modal-backdrop"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal-box">
            {/* Header modal */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40,
                  borderRadius: '50%',
                  background: 'rgba(14,196,126,.15)',
                  border: '1px solid rgba(14,196,126,.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>✅</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>
                    {t('pos_confirm_sale')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {cart.length} article{cart.length > 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              <button className="mini-btn" onClick={() => setShowModal(false)}>
                <X size={14} />
              </button>
            </div>

            {/* Liste items */}
            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
              {cart.map(item => (
                <div key={item.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text2)' }}>
                    {item.emoji} {item.name} ×{item.qty}
                  </span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text)' }}>
                    {fmt(item.price * item.qty)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 14px',
              background: 'rgba(14,196,126,.08)',
              border: '1px solid rgba(14,196,126,.2)',
              borderRadius: 10,
              marginBottom: 16,
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('pos_total')}</span>
              <span style={{
                fontSize: 20,
                fontWeight: 900,
                color: 'var(--acc2)',
                fontFamily: 'var(--mono)',
              }}>{fmt(total)}</span>
            </div>

            {/* WhatsApp toggle */}
            <div style={{ padding:'14px 16px', marginBottom:12, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: sendWhatsApp ? 12 : 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:20 }}>📱</span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>
                      {lang === 'fr' ? 'Envoyer le ticket WhatsApp' : lang === 'en' ? 'Send WhatsApp receipt' : lang === 'es' ? 'Enviar ticket WhatsApp' : 'Invia scontrino WhatsApp'}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>
                      {lang === 'fr' ? 'Le client recevra son reçu sur WhatsApp' : 'Customer receives receipt on WhatsApp'}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setSendWhatsApp(!sendWhatsApp)} style={{
                  width:44, height:24, borderRadius:99, flexShrink:0,
                  background: sendWhatsApp ? '#25D366' : 'var(--bg4)',
                  border:'none', cursor:'pointer', position:'relative', transition:'background .2s',
                }}>
                  <div style={{
                    position:'absolute', top:2, width:20, height:20,
                    left: sendWhatsApp ? 22 : 2,
                    borderRadius:'50%', background:'#fff', transition:'left .2s',
                    boxShadow:'0 2px 4px rgba(0,0,0,.2)',
                  }} />
                </button>
              </div>
              {sendWhatsApp && (
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', color:'var(--text3)', marginBottom:6 }}>
                    {lang === 'fr' ? 'Numéro WhatsApp du client' : 'Customer WhatsApp number'}
                  </label>
                  <input className="input" type="tel" placeholder="+221 77 000 00 00" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                </div>
              )}
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmSale}
                disabled={isSaving || sendingWA}
                style={{
                  flex: 1,
                  background: (isSaving || sendingWA) ? 'var(--bg4)' : 'linear-gradient(135deg, var(--acc2), #059669)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px',
                  fontSize: 14,
                  fontWeight: 700,
                  color: (isSaving || sendingWA) ? 'var(--text3)' : '#fff',
                  cursor: (isSaving || sendingWA) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: (isSaving || sendingWA) ? 'none' : '0 4px 16px rgba(14,196,126,.35)',
                }}
              >{sendingWA ? '📱 Envoi WhatsApp…' : isSaving ? '⏳ Enregistrement…' : `✅ ${t('pos_validate')}`}</button>
              <button
                onClick={() => { printTicket(); confirmSale() }}
                className="mini-btn"
                style={{ padding: '12px 16px', fontSize: 13 }}
              >🖨️ Ticket</button>
              <button
                onClick={() => {
                  generateInvoice({
                    type: 'facture',
                    lang,
                    items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, emoji: i.emoji })),
                    discount: discount ?? undefined,
                    paymentMode: payMode,
                  })
                }}
                className="mini-btn"
                style={{ padding: '12px 14px', fontSize: 13 }}
              >📄</button>
            </div>
          </div>
        </div>
      )}

      {/* FAB mobile — voir panier */}
      {isMobile && mobileView === 'products' && cart.length > 0 && (
        <button
          onClick={() => setMobileView('cart')}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 200,
            background: 'linear-gradient(135deg, var(--p), var(--p2))',
            color: '#fff',
            border: 'none',
            borderRadius: 99,
            padding: '14px 22px',
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(91,78,232,.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: 'inherit',
          }}
        >
          🛍️ {t('pos_cart')} · {cart.length}
        </button>
      )}

      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
    </>
  )
}
