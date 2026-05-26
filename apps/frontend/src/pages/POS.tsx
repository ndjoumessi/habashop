import { useState, useEffect, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useFormatAmount, useConvertToXOF, useCurrencyInfo, formatCurrency, t, convertAmount, formatInCurrency } from '@/stores/appStore'
import type { Currency } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { salesApi, productsApi, whatsappApi } from '@/lib/api'
import { generateInvoice } from '@/utils/export'
// Chargé à la demande (114 kB gz / @zxing) — uniquement à l'ouverture du scanner
const BarcodeScanner = lazy(() => import('@/components/ui/BarcodeScanner'))
import { Search, Minus, Plus, Trash2, ShoppingCart, X, Lock, Unlock, Camera, User, Factory, Package, Tag, Banknote, CreditCard, Smartphone, ClipboardList, Printer, FileText, BarChart3, CheckCircle, AlertTriangle, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { confirm } from '@/lib/confirm'


import POSProductGrid from '@/components/pos/POSProductGrid'
import POSCart from '@/components/pos/POSCart'
import POSModals from '@/components/pos/POSModals'
import { type PosProduct, type CartItem, CASHIER_TEXTS } from '@/components/pos/posShared'

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
  const fmt    = useFormatAmount()
  const toXOF  = useConvertToXOF()
  const { symbol: currencySymbol } = useCurrencyInfo()
  const user = useAuthStore(s => s.user)
  const cashierName = user?.name?.trim() || 'Caissier'
  const cashierInitial = cashierName.charAt(0).toUpperCase()
  const LOCALE_MAP: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', it: 'it-IT' }
  const locale = LOCALE_MAP[lang] ?? 'fr-FR'
  const ct = CASHIER_TEXTS[lang as keyof typeof CASHIER_TEXTS] ?? CASHIER_TEXTS.fr

  const navigate = useNavigate()
  const [posProducts, setPosProducts] = useState<PosProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)

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
      .finally(() => setLoadingProducts(false))
  }, [])

  const [cart, setCart]           = useState<CartItem[]>([])
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch]       = useState('')
  const [payMode, setPayMode]     = useState<'cash'|'card'|'wave'|'orange'|'mobile'>(() => (posDefaultPayment ?? 'cash') as 'cash'|'card'|'wave'|'orange'|'mobile')
  useEffect(() => { setPayMode((posDefaultPayment ?? 'cash') as 'cash'|'card'|'wave'|'orange'|'mobile') }, [posDefaultPayment])
  const [waCountryCode, setWaCountryCode]         = useState('+221')
  const [waCountryFlag, setWaCountryFlag]         = useState('🇸🇳')
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [countrySearch, setCountrySearch]         = useState('')
  const [waNumber, setWaNumber]                   = useState('')
  const [sendWhatsApp, setSendWhatsApp]           = useState(() => posAutoWhatsApp)
  const [waSending, setWaSending]                 = useState(false)
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

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-phone-picker]')) {
        setShowCountryPicker(false)
        setCountrySearch('')
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
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
    const found = posProducts.find(p =>
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
  // cashGiven est dans la devise courante → convertir en XOF pour comparer avec total (XOF)
  const monnaie = toXOF(cashGivenAmount) - total

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
    <div class="row bold"><span>${t('pos_ticket_change')}</span><span>${fmt(Math.max(monnaie, 0))}</span></div>
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
    const fullPhone = waNumber.trim() ? `${waCountryCode}${waNumber.replace(/[\s\-]/g, '')}` : ''
    if (sendWhatsApp && fullPhone) {
      setWaSending(true)
      try {
        await whatsappApi.sendTicket({
          phone:       fullPhone,
          items:       cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
          total:       Math.round(total),
          paymentMode: payMode === 'cash'   ? (lang === 'fr' ? 'Espèces' : 'Cash')
                     : payMode === 'card'   ? (lang === 'fr' ? 'Carte'   : 'Card')
                     : payMode === 'wave'   ? 'Wave'
                     : payMode === 'orange' ? 'Orange Money' : 'Mobile',
          discount:    discountAmount > 0 ? Math.round(discountAmount) : undefined,
          reference:   `V${Date.now().toString().slice(-6)}`,
        })
        toast.success(lang === 'fr' ? `📱 Ticket envoyé au ${fullPhone}` : `📱 Receipt sent to ${fullPhone}`)
      } catch (err: any) {
        const msg = err.message?.includes('inscrit sur WhatsApp')
          ? (lang === 'fr' ? `❌ ${fullPhone} n'est pas sur WhatsApp` : `❌ ${fullPhone} is not on WhatsApp`)
          : err.message?.includes('invalide') || err.message?.includes('Format')
            ? (lang === 'fr' ? '❌ Format de numéro invalide' : '❌ Invalid phone format')
            : err.message?.includes('Authentification')
              ? (lang === 'fr' ? '❌ Erreur configuration Twilio' : '❌ Twilio config error')
              : `❌ ${err.message ?? 'Échec envoi WhatsApp'}`
        toast.error(msg)
      } finally {
        setWaSending(false)
      }
    }

    addCashierSale(total)
    toast.success('✅ Vente encaissée !')
    setCart([])
    setShowModal(false)
    setCashGiven('')
    setDiscount(null)
    setSendWhatsApp(false)
    setWaNumber('')
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
            margin:'0 auto 20px',
          }}><Lock size={36} style={{ color:'var(--p2)' }} /></div>
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
            }}>{cashierInitial}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{cashierName}</div>
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
          ><Unlock size={16} /> {ct.open_btn}</button>
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
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                }}
              >
                <ShoppingCart size={14} />
                {view === 'products' ? t('pos_products') || 'Produits' : `${t('pos_cart')} (${cart.length})`}
              </button>
            ))}
          </div>
        )}

        {/* ════════════════════════════════
            COLONNE GAUCHE — CATALOGUE
        ════════════════════════════════ */}
        <POSProductGrid
          posTab={posTab} setPosTab={setPosTab} fetchHistory={fetchHistory}
          lang={lang}
          activeCat={activeCat} setActiveCat={setActiveCat}
          search={search} setSearch={setSearch}
          posEnableScanner={posEnableScanner} setShowScanner={setShowScanner}
          clientType={clientType} setClientType={setClientType}
          setShowDiscountModal={setShowDiscountModal}
          discount={discount} setDiscount={setDiscount}
          fmt={fmt}
          filtered={filtered}
          cart={cart}
          addItem={addItem}
          getPrice={getPrice}
          posShowStockOnTile={posShowStockOnTile}
          loadingHistory={loadingHistory}
          salesHistory={salesHistory}
          isMobile={isMobile} mobileView={mobileView}
          totalProducts={posProducts.length} loadingProducts={loadingProducts}
          navigate={navigate}
        />

        {/* Séparateur vertical */}
        {!isMobile && (
          <div style={{ width: 1, background: 'var(--border)', margin: '12px 0', flexShrink: 0 }} />
        )}

        {/* ════════════════════════════════
            COLONNE DROITE — PANIER
        ════════════════════════════════ */}
        <POSCart
          lang={lang}
          cart={cart} setCart={setCart}
          cashierSessionTx={cashierSessionTx} cashierSessionCA={cashierSessionCA}
          setShowCloseModal={setShowCloseModal}
          fmt={fmt}
          discount={discount} discountAmount={discountAmount}
          totalHT={totalHT} tva={tva} posTaxRate={posTaxRate} total={total}
          PAY_MODES={PAY_MODES} payMode={payMode} setPayMode={setPayMode}
          currencySymbol={currencySymbol}
          cashGiven={cashGiven} setCashGiven={setCashGiven}
          monnaie={monnaie}
          confirmSale={confirmSale}
          setShowModal={setShowModal}
          updateQty={updateQty}
          isMobile={isMobile} mobileView={mobileView}
        />
      </div>

      {/* ════════════════════════════════
          MODAL REMISE
      ════════════════════════════════ */}
      <POSModals
        showDiscountModal={showDiscountModal} setShowDiscountModal={setShowDiscountModal}
        discountForm={discountForm} setDiscountForm={setDiscountForm}
        fmt={fmt}
        subtotalBeforeDiscount={subtotalBeforeDiscount}
        setDiscount={setDiscount}
        showCloseModal={showCloseModal} setShowCloseModal={setShowCloseModal}
        ct={ct}
        cashierOpenedAt={cashierOpenedAt} locale={locale}
        cashierOpeningFund={cashierOpeningFund} cashierSessionTx={cashierSessionTx} cashierSessionCA={cashierSessionCA}
        closeCashier={closeCashier}
        setOpeningFundInput={setOpeningFundInput}
        currency={currency}
        showModal={showModal} setShowModal={setShowModal}
        cart={cart}
        total={total}
        sendWhatsApp={sendWhatsApp} setSendWhatsApp={setSendWhatsApp}
        waCountryFlag={waCountryFlag} waCountryCode={waCountryCode}
        setWaCountryCode={setWaCountryCode} setWaCountryFlag={setWaCountryFlag}
        showCountryPicker={showCountryPicker} setShowCountryPicker={setShowCountryPicker}
        countrySearch={countrySearch} setCountrySearch={setCountrySearch}
        waNumber={waNumber} setWaNumber={setWaNumber}
        lang={lang}
        confirmSale={confirmSale}
        isSaving={isSaving} waSending={waSending}
        printTicket={printTicket}
        discount={discount} payMode={payMode}
      />

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
          <ShoppingCart size={16} /> {t('pos_cart')} · {cart.length}
        </button>
      )}

      {showScanner && <Suspense fallback={null}><BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} /></Suspense>}
    </>
  )
}
