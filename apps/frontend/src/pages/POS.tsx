import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore, useFormatAmount, useConvertToXOF, useCurrencyInfo, t, formatInCurrency } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { salesApi, productsApi, whatsappApi, loyaltyApi, mtnMomoApi } from '@/lib/api'
import { resolveTierPrice } from '@/lib/pricing'
// Chargé à la demande (114 kB gz / @zxing) — uniquement à l'ouverture du scanner
const BarcodeScanner = lazy(() => import('@/components/ui/BarcodeScanner'))
import { ShoppingCart } from 'lucide-react'
import toast from 'react-hot-toast'
import { announce } from '@/lib/announce'

import POSProductGrid from '@/components/pos/POSProductGrid'
import POSCart from '@/components/pos/POSCart'
import POSModals from '@/components/pos/POSModals'
import POSCashierClosed from '@/components/pos/POSCashierClosed'
import RefundModal from '@/components/pos/RefundModal'
import TicketZModal from '@/components/pos/TicketZModal'
import POSSuccessModal from '@/components/pos/POSSuccessModal'
import { printTicket as buildAndPrintTicket } from '@/components/pos/posTicket'
import { type PosProduct, CASHIER_TEXTS, computePosVat } from '@/components/pos/posShared'

export default function POS() {
  const {
    lang, currency,
    cashierOpen, cashierOpenedAt,
    cashierOpeningFund, cashierSessionTx, cashierSessionCA,
    openCashier, closeCashier, addCashierSale,
    posTaxRate, posShowStockOnTile, posDefaultFund,
    posDefaultPayment, priceMode, posAutoprint, requireCashier,
    enableScanner: posEnableScanner, autoWhatsApp: posAutoWhatsApp, enableLoyalty,
    // Panier persisté dans le store (survit nav + refresh)
    cart, addCartItem, updateCartQty, setCart, clearCart,
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
        priceTiers: Array.isArray(p.priceTiers) ? p.priceTiers : undefined,
      }))))
      .catch(() => {})
      .finally(() => setLoadingProducts(false))
  }, [])

  // cart est désormais dans useAppStore (persisté zustand). Voir destructuring ci-dessus.
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch]       = useState('')
  const [payMode, setPayMode]     = useState<'cash'|'card'|'wave'|'orange'|'mtn'>(() => (posDefaultPayment ?? 'cash') as 'cash'|'card'|'wave'|'orange'|'mtn')
  useEffect(() => { setPayMode((posDefaultPayment ?? 'cash') as 'cash'|'card'|'wave'|'orange'|'mtn') }, [posDefaultPayment])
  const [waCountryCode, setWaCountryCode]         = useState('+221')
  const [waCountryFlag, setWaCountryFlag]         = useState('🇸🇳')
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [countrySearch, setCountrySearch]         = useState('')
  const [waNumber, setWaNumber]                   = useState('')
  const [sendWhatsApp, setSendWhatsApp]           = useState(() => posAutoWhatsApp)
  const [waSending, setWaSending]                 = useState(false)
  const [cashGiven, setCashGiven] = useState('')
  // Paiement mixte (split, max 2 méthodes). Montants saisis en devise d'AFFICHAGE.
  const [mixedOn, setMixedOn]   = useState(false)
  const [mixedM1, setMixedM1]   = useState<'cash'|'mobile'|'card'>('cash')
  const [mixedM2, setMixedM2]   = useState<'cash'|'mobile'|'card'>('mobile')
  const [mixedAmt1, setMixedAmt1] = useState('')
  // Client lié (via « Nouvelle vente » depuis la fiche client) → fidélité v2 (remise + points).
  const location = useLocation()
  // Client lié : initialisé depuis nav-state (« Nouvelle vente » fiche client) PUIS settable via le
  // sélecteur inline du panier (recherche texte ou scan QR carte fidélité).
  const [linkedCustomer, setLinkedCustomer] = useState<{ id: string; name: string } | null>(() => ((location.state as any)?.customer ?? null))
  const [loyaltyPct, setLoyaltyPct] = useState(0)  // % remise du palier du client lié (0 si N/A)
  const [loyaltyTier, setLoyaltyTier] = useState('')  // palier du client lié (chip sélecteur)
  useEffect(() => {
    if (!linkedCustomer?.id || !enableLoyalty) { setLoyaltyPct(0); setLoyaltyTier(''); return }
    loyaltyApi.get(linkedCustomer.id).then(d => {
      const pct = d.tier === 'Gold' ? (d.goldDiscount ?? 0) : d.tier === 'Silver' ? (d.silverDiscount ?? 0) : (d.bronzeDiscount ?? 0)
      setLoyaltyPct(Number(pct) || 0)
      setLoyaltyTier(d.tier ?? '')
    }).catch(() => { setLoyaltyPct(0); setLoyaltyTier('') })
  }, [linkedCustomer?.id, enableLoyalty])
  const [showModal, setShowModal] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [clientType, setClientType] = useState<'retail'|'wholesale'|'semi'>('retail')
  const [discount, setDiscount] = useState<{ type:'percent'|'amount'; value:number; reason:string } | null>(null)
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountForm, setDiscountForm] = useState({ type:'percent' as 'percent'|'amount', value:0, reason:'' })
  const [isSaving, setIsSaving] = useState(false)
  // ── MTN MoMo POS ──────────────────────────────────────────────────────────
  const [mtnPhone, setMtnPhone]   = useState('')
  const [mtnStatus, setMtnStatus] = useState<'idle'|'requesting'|'polling'|'success'|'failed'|'timeout'>('idle')
  const [mtnReferenceId, setMtnReferenceId] = useState<string|null>(null)
  const [mtnError, setMtnError]   = useState('')
  const mtnReferenceIdRef = useRef<string|null>(null)
  const [posTab, setPosTab] = useState<'pos'|'history'>('pos')
  const [showTicketZ, setShowTicketZ] = useState(false)
  const [salesHistory, setSalesHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  // Remboursement : réservé MANAGER + ADMIN (anti-fraude). Le caissier ne voit pas l'action.
  const canRefund = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '')
  const [refundSale, setRefundSale] = useState<any | null>(null)
  const [refunding, setRefunding] = useState(false)

  const doRefund = async (reason: string, restock: boolean) => {
    if (!refundSale) return
    setRefunding(true)
    try {
      await salesApi.refund(refundSale.id, { reason, restock })
      // MAJ optimiste de la ligne : status refunded + restocked (badge + total barré)
      setSalesHistory(prev => prev.map(s => s.id === refundSale.id
        ? { ...s, status: 'refunded', refundedAt: new Date().toISOString(), restocked: restock }
        : s))
      toast.success(lang === 'en' ? 'Sale refunded' : lang === 'es' ? 'Venta reembolsada' : lang === 'it' ? 'Vendita rimborsata' : 'Vente remboursée')
      announce(lang === 'en' ? 'Sale refunded' : lang === 'es' ? 'Venta reembolsada' : lang === 'it' ? 'Vendita rimborsata' : 'Vente remboursée')
      setRefundSale(null)
    } catch (e: any) {
      const status = e?.status ?? e?.response?.status
      const msg = status === 409
        ? (lang === 'en' ? 'Sale already refunded' : lang === 'es' ? 'Venta ya reembolsada' : lang === 'it' ? 'Vendita già rimborsata' : 'Vente déjà remboursée')
        : status === 403
          ? (lang === 'en' ? 'Not allowed' : lang === 'es' ? 'No permitido' : lang === 'it' ? 'Non consentito' : 'Action non autorisée')
          : (lang === 'en' ? 'Refund failed' : lang === 'es' ? 'Error al reembolsar' : lang === 'it' ? 'Rimborso fallito' : 'Échec du remboursement')
      toast.error(msg)
      if (status === 409) {
        // déjà remboursée côté serveur → refléter l'état + fermer
        setSalesHistory(prev => prev.map(s => s.id === refundSale.id ? { ...s, status: 'refunded' } : s))
        setRefundSale(null)
      }
    } finally {
      setRefunding(false)
    }
  }
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
      toast.success(`${found.name} scanné`)
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

  // basePrice selon type client (retail/semi/wholesale). La promo et les paliers s'appliquent ensuite.
  const getBasePrice = (p: PosProduct) => {
    if (clientType === 'wholesale') return p.priceWholesale
    if (clientType === 'semi')      return p.priceSemiWholesale
    return p.price
  }
  // Calcule prix + tierLabel pour un produit à une quantité donnée (promo > tier > base).
  const computePriceForItem = (p: PosProduct, qty: number): { price: number; tierLabel?: string } => {
    const basePrice = getBasePrice(p)
    return resolveTierPrice(qty, basePrice, p.priceTiers ?? null, { active: !!p.promotion, price: p.promotionPrice })
  }
  // Compat : getPrice(p) = qty=1 (utilisé pour affichage prix sur la tuile produit)
  const getPrice = (p: PosProduct) => computePriceForItem(p, 1).price

  // Filtrage produits — mémoïsé : recalculé seulement quand produits/catégorie/recherche changent
  const filtered = useMemo(() => posProducts.filter(p =>
    (activeCat === 'all' || p.cat === activeCat) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  ), [posProducts, activeCat, search])

  // Index produits par id pour recalcul rapide
  const productById = useMemo(
    () => new Map<number | string, PosProduct>(posProducts.map(p => [p.id, p] as [number | string, PosProduct])),
    [posProducts],
  )

  // Actions panier — calcul price+tierLabel via computePriceForItem (logique métier
  // qui dépend de clientType + promo + tiers), puis délégation au store pour mutation.
  const addItem = (p: PosProduct) => {
    const existing = cart.find(i => i.id === p.id)
    const newQty = existing ? existing.qty + 1 : 1
    const { price, tierLabel } = computePriceForItem(p, newQty)
    if (existing) {
      // produit déjà au panier → +1 et recalcule price (utile si on franchit un palier)
      updateCartQty(p.id, 1, price, tierLabel)
    } else {
      addCartItem({ id: p.id, name: p.name, price, qty: 1, emoji: p.emoji, tierLabel })
    }
  }

  const updateQty = (id: number | string, delta: number) => {
    const item = cart.find(i => i.id === id)
    if (!item) return
    const newQty = item.qty + delta
    if (newQty <= 0) {
      // Le store filtrera (qty<=0 retiré) — pas besoin de calculer le prix
      updateCartQty(id, delta)
      return
    }
    const product = productById.get(id)
    if (!product) { updateCartQty(id, delta); return }
    const { price, tierLabel } = computePriceForItem(product, newQty)
    // Toast discret quand le palier change (UX : transparence prix)
    if ((item.tierLabel ?? '') !== (tierLabel ?? '')) {
      const label = tierLabel ?? (lang === 'en' ? 'standard' : lang === 'es' ? 'estándar' : lang === 'it' ? 'standard' : 'standard')
      toast.success(
        lang === 'en' ? `Price tier: ${label}` :
        lang === 'es' ? `Tarifa: ${label}` :
        lang === 'it' ? `Tariffa: ${label}` :
        `Prix : ${label}`,
        { id: `tier-${id}`, duration: 1800 },
      )
    }
    updateCartQty(id, delta, price, tierLabel)
  }

  // Calculs
  const subtotalBeforeDiscount = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discountAmount = discount
    ? discount.type === 'percent'
      ? subtotalBeforeDiscount * discount.value / 100
      : Math.min(discount.value, subtotalBeforeDiscount)
    : 0
  const sub     = subtotalBeforeDiscount - discountAmount
  // Application de la config TVA (helper pur testable) — le mode TTC/HT est l'unique pilote :
  // TTC → prix catalogue incluent la TVA (extraite) ; HT → TVA ajoutée au-dessus.
  const pricesIncludeVat = priceMode !== 'HT'
  const { totalHT, tva, total } = computePosVat(sub, posTaxRate, pricesIncludeVat)
  // ── Loyalty v2 : remise fidélité du client lié (mirroir du backend, plafond combiné 50%) ──
  // `total` = BRUT (envoyé au backend qui applique le Modèle A) ; `netTotal` = ce que le
  // caissier voit/encaisse. Les deux convergent (même % + même plafond que computeLoyaltyDiscount).
  const loyaltyDiscount = (linkedCustomer && loyaltyPct > 0)
    ? Math.max(0, Math.min(Math.round(total * loyaltyPct / 100), Math.round(total * 0.5) - discountAmount))
    : 0
  const netTotal = Math.max(0, total - loyaltyDiscount)
  const cashGivenAmount = parseFloat(cashGiven) || 0
  // cashGiven est dans la devise courante → convertir en XOF pour comparer avec le NET (XOF)
  const monnaie = toXOF(cashGivenAmount) - netTotal

  // ── Paiement mixte : montant ligne 1 en devise affichage → XOF ; ligne 2 = reste (sur NET) ──
  const mixedAmt1XOF = Math.min(netTotal, Math.max(0, toXOF(parseFloat(mixedAmt1) || 0)))
  const mixedAmt2XOF = Math.max(0, netTotal - mixedAmt1XOF)
  const mixedValid = mixedAmt1XOF > 0 && mixedAmt1XOF < netTotal && mixedM1 !== mixedM2
  // Ventilation XOF des 2 méthodes vers les 3 seaux backend.
  const mixedSplit = (() => {
    const b: { cashAmount: number; mobileMoneyAmount: number; cardAmount: number } = { cashAmount: 0, mobileMoneyAmount: 0, cardAmount: 0 }
    const key = (m: 'cash'|'mobile'|'card') => m === 'cash' ? 'cashAmount' : m === 'card' ? 'cardAmount' : 'mobileMoneyAmount'
    b[key(mixedM1) as keyof typeof b] += mixedAmt1XOF
    b[key(mixedM2) as keyof typeof b] += mixedAmt2XOF
    return b
  })()

  const PAY_MODES = [
    { id: 'cash',   label: t('pos_cash'),   icon: '💵', color: '#10B981' },
    { id: 'card',   label: t('pos_card'),   icon: '💳', color: '#5B4EE8' },
    { id: 'wave',   label: 'Wave',          icon: '🌊', color: '#1B9AF5' },
    { id: 'orange', label: 'Orange Money',  icon: '🟠', color: '#FF6600' },
    { id: 'mtn',    label: 'MTN MoMo',      icon: '📶', color: '#FFCC00' },
  ] as { id: 'cash'|'card'|'wave'|'orange'|'mtn'; label: string; icon: string; color: string }[]

  const printTicket = () => buildAndPrintTicket({
    lang, locale, cart, discount, discountAmount,
    totalHT, tva, posTaxRate, total: netTotal, payMode, cashGiven, currency, monnaie, fmt,
    mixed: mixedOn ? mixedSplit : null,
  })

  // ── MTN MoMo — normalisation MSISDN ──────────────────────────────────────
  // Cameroun : 6XXXXXXXX → 237XXXXXXXXX, +237/237 → normalisés.
  // Tout autre pays : 8–15 chiffres acceptés tels quels (l'API MTN valide côté serveur).
  const normalizeCameroonPhone = (raw: string): string | null => {
    const s = raw.replace(/[\s\-\(\)]/g, '')          // garde + pour détecter +237
    if (/^\+237[0-9]{9}$/.test(s)) return s.slice(1) // +237XXXXXXXXX → 237XXXXXXXXX
    if (/^237[0-9]{9}$/.test(s))   return s           // déjà normalisé 12 chiffres
    if (/^6[0-9]{8}$/.test(s))     return `237${s}`  // 9 chiffres locaux → préfixer 237
    const d = s.replace(/^\+/, '')                    // retire + éventuel
    if (/^[0-9]{8,15}$/.test(d))   return d           // tout pays : 8–15 chiffres
    return null
  }

  const handleMtnPhone = (v: string) => { setMtnPhone(v); if (mtnError) setMtnError('') }

  const onMtnRetry = () => {
    setMtnPhone('')
    setMtnStatus('idle')
    setMtnError('')
    mtnReferenceIdRef.current = null
    setMtnReferenceId(null)
  }

  const startMtnPayment = async () => {
    setMtnError('')
    const phone = normalizeCameroonPhone(mtnPhone)
    if (!phone) {
      setMtnError(
        lang === 'en' ? 'Enter a valid number (8–15 digits, e.g. 677000000)' :
        lang === 'es' ? 'Ingrese un número válido (8–15 dígitos, ej: 677000000)' :
        lang === 'it' ? 'Inserire un numero valido (8–15 cifre, es: 677000000)' :
        'Saisissez un numéro valide (8–15 chiffres, ex: 677000000)',
      )
      return
    }
    setMtnStatus('requesting')
    try {
      const { referenceId } = await mtnMomoApi.request({ amount: netTotal, phoneNumber: phone })
      mtnReferenceIdRef.current = referenceId
      setMtnReferenceId(referenceId)
      setMtnStatus('polling')
    } catch {
      setMtnStatus('failed')
      toast.error(
        lang === 'en' ? 'MTN MoMo request failed — retry' :
        lang === 'es' ? 'Error MTN MoMo — reintente' :
        lang === 'it' ? 'Errore MTN MoMo — riprova' :
        'Échec de la demande MTN MoMo — réessayez',
      )
    }
  }

  // Polling 3s, max 40 tours (2 min)
  useEffect(() => {
    if (mtnStatus !== 'polling') return
    let done = false
    let count = 0
    const MAX = 40
    const poll = async () => {
      if (done) return
      count++
      if (count > MAX) { done = true; setMtnStatus('timeout'); return }
      try {
        const ref = mtnReferenceIdRef.current
        if (!ref) return
        const res = await mtnMomoApi.status(ref)
        if (res.status === 'SUCCESSFUL') { done = true; setMtnStatus('success') }
        else if (res.status === 'FAILED') { done = true; setMtnStatus('failed') }
      } catch { /* fail-silent */ }
    }
    const timer = setInterval(poll, 3000)
    return () => { done = true; clearInterval(timer) }
  }, [mtnStatus])

  // Déclenche confirmSale dès que MTN passe à 'success' — la closure est fraîche
  // (cet effet s'exécute APRÈS le render qui a posé mtnStatus='success').
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mtnStatus === 'success') confirmSale(mtnReferenceIdRef.current ?? undefined)
  }, [mtnStatus]) // intentionally omits confirmSale (fresh via post-render execution)

  // Réinitialise le flux MTN quand on change de mode de paiement
  useEffect(() => {
    if (payMode !== 'mtn') {
      setMtnPhone('')
      setMtnStatus('idle')
      setMtnReferenceId(null)
      mtnReferenceIdRef.current = null
    }
  }, [payMode])

  const confirmSale = async (mtnRef?: string) => {
    // Garde-fou cash : refuser si le montant reçu (converti en XOF) < total.
    // Les modes Wave/Orange/Carte/Mobile n'ont pas de saisie de montant → pas concernés.
    // En paiement mixte, le garde-fou cash ne s'applique pas (la somme = total par construction).
    if (!mixedOn && payMode === 'cash') {
      const given = toXOF(parseFloat(cashGiven) || 0)
      if (given < netTotal) {
        toast.error(
          lang === 'en' ? 'Insufficient amount — please enter amount received' :
          lang === 'es' ? 'Monto insuficiente — ingrese el monto recibido' :
          lang === 'it' ? "Importo insufficiente — inserire l'importo ricevuto" :
          'Montant insuffisant — veuillez saisir le montant reçu',
        )
        return
      }
    }
    if (mixedOn && !mixedValid) {
      toast.error(lang === 'en' ? 'Split amounts must sum to the total' : lang === 'es' ? 'La suma de los pagos debe igualar el total' : lang === 'it' ? 'La somma dei pagamenti deve uguagliare il totale' : 'La somme des paiements doit égaler le total')
      return
    }
    setIsSaving(true)
    try {
      await salesApi.create({
        items: cart.map(i => ({
          productId: /^\d+$/.test(String(i.id))
            ? `demo-PRD-${String(i.id).padStart(3, '0')}`
            : String(i.id),
          qty: i.qty,
          price: i.price,
          tierLabel: i.tierLabel ?? null,
        })),
        paymentMode: mixedOn ? 'mixed' : payMode,
        total,  // BRUT — le backend applique la remise fidélité (Modèle A) → sale.total = net
        customerId: linkedCustomer?.id ?? null,
        discount: discount ? { type: discount.type, amount: discountAmount } : null,
        ...(mixedOn ? mixedSplit : {}),
        mtnMomoReference: mtnRef ?? null,
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
          paymentMode: payMode === 'cash'   ? (lang === 'en' ? 'Cash' : lang === 'es' ? 'Efectivo' : lang === 'it' ? 'Contanti' : 'Espèces')
                     : payMode === 'card'   ? (lang === 'en' ? 'Card' : lang === 'es' ? 'Tarjeta' : lang === 'it' ? 'Carta' : 'Carte')
                     : payMode === 'wave'   ? 'Wave'
                     : payMode === 'orange' ? 'Orange Money'
                     : payMode === 'mtn'    ? 'MTN MoMo' : 'Mobile',
          discount:    discountAmount > 0 ? Math.round(discountAmount) : undefined,
          reference:   `V${Date.now().toString().slice(-6)}`,
        })
        toast.success(lang === 'en' ? `Receipt sent to ${fullPhone}` : lang === 'es' ? `Recibo enviado al ${fullPhone}` : lang === 'it' ? `Ricevuta inviata al ${fullPhone}` : `Ticket envoyé au ${fullPhone}`)
      } catch (err: any) {
        const msg = err.message?.includes('inscrit sur WhatsApp')
          ? (lang === 'en' ? `${fullPhone} is not on WhatsApp` : lang === 'es' ? `${fullPhone} no está en WhatsApp` : lang === 'it' ? `${fullPhone} non è su WhatsApp` : `${fullPhone} n'est pas sur WhatsApp`)
          : err.message?.includes('invalide') || err.message?.includes('Format')
            ? (lang === 'en' ? 'Invalid phone format' : lang === 'es' ? 'Formato de número inválido' : lang === 'it' ? 'Formato numero non valido' : 'Format de numéro invalide')
            : err.message?.includes('Authentification')
              ? (lang === 'en' ? 'Twilio config error' : lang === 'es' ? 'Error de configuración Twilio' : lang === 'it' ? 'Errore configurazione Twilio' : 'Erreur configuration Twilio')
              : `${err.message ?? 'Échec envoi WhatsApp'}`
        toast.error(msg)
      } finally {
        setWaSending(false)
      }
    }

    addCashierSale(total)
    toast.success('Vente encaissée !')
    announce(lang === 'en' ? 'Sale completed' : lang === 'es' ? 'Venta registrada' : lang === 'it' ? 'Vendita registrata' : 'Vente encaissée')
    if (posAutoprint) printTicket() // impression auto si config POS — avant le vidage du panier
    // On NE vide PAS le panier ici : on ouvre la modale de SUCCÈS (récap + « Imprimer le reçu »
    // + « Nouvelle vente ») → le panier/total restent dispos pour réimprimer. Le reset se fait
    // dans newSale(). (Avant : tout disparaissait sans proposer d'imprimer.)
    setShowModal(false)
    setShowSuccess(true)
    setIsSaving(false)
  }

  // Clôt la modale de succès et réinitialise pour la prochaine vente.
  // setShowSuccess(false) EN PREMIER → la modale se ferme TOUJOURS, même si un reset
  // ultérieur venait à échouer (robustesse : pas de modale bloquée).
  const newSale = () => {
    setShowSuccess(false)
    clearCart()
    setCashGiven('')
    setDiscount(null)
    setSendWhatsApp(false)
    setWaNumber('')
    setMixedOn(false)
    setMixedAmt1('')
    setMtnPhone('')
    setMtnStatus('idle')
    setMtnError('')
    setMtnReferenceId(null)
    mtnReferenceIdRef.current = null
  }

  // ─── RENDER ──────────────────────────────

  // Ouverture de caisse exigée seulement si la config `requireCashier` est ON
  // (sinon, la caisse peut vendre directement sans cérémonie d'ouverture).
  if (requireCashier && !cashierOpen) {
    return (
      <POSCashierClosed
        ct={ct}
        currency={currency}
        currencySymbol={currencySymbol}
        openingFundInput={openingFundInput}
        setOpeningFundInput={setOpeningFundInput}
        cashierName={cashierName}
        cashierInitial={cashierInitial}
        locale={locale}
        onOpen={() => {
          openCashier(inputValue)
          toast.success(`${ct.cashier_label} ouverte — Fond: ${displayFund}`)
        }}
      />
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
          canRefund={canRefund} onRefundClick={setRefundSale}
          canCloseDay={canRefund} onCloseDay={() => setShowTicketZ(true)}
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
          totalHT={totalHT} tva={tva} posTaxRate={posTaxRate} total={netTotal}
          loyaltyDiscount={loyaltyDiscount} loyaltyPct={loyaltyPct} loyaltyCustomerName={linkedCustomer?.name ?? null}
          linkedCustomer={linkedCustomer} setLinkedCustomer={setLinkedCustomer} enableLoyalty={enableLoyalty} loyaltyTier={loyaltyTier}
          PAY_MODES={PAY_MODES} payMode={payMode} setPayMode={setPayMode}
          currencySymbol={currencySymbol}
          cashGiven={cashGiven} setCashGiven={setCashGiven}
          monnaie={monnaie}
          confirmSale={confirmSale}
          setShowModal={setShowModal}
          updateQty={updateQty}
          isMobile={isMobile} mobileView={mobileView}
          mixedOn={mixedOn} setMixedOn={setMixedOn}
          mixedM1={mixedM1} setMixedM1={setMixedM1} mixedM2={mixedM2} setMixedM2={setMixedM2}
          mixedAmt1={mixedAmt1} setMixedAmt1={setMixedAmt1}
          mixedAmt2XOF={mixedAmt2XOF} mixedValid={mixedValid}
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
        total={netTotal}
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
        cashGiven={cashGiven} toXOF={toXOF}
        mixedOn={mixedOn} mixedValid={mixedValid}
        mtnPhone={mtnPhone} setMtnPhone={handleMtnPhone}
        mtnStatus={mtnStatus} mtnError={mtnError}
        startMtnPayment={startMtnPayment} onMtnRetry={onMtnRetry}
      />

      {/* MODALE SUCCÈS — après vente : récap + Imprimer le reçu + Nouvelle vente */}
      <POSSuccessModal
        show={showSuccess}
        lang={lang}
        total={netTotal}
        monnaie={monnaie}
        showChange={!mixedOn && payMode === 'cash'}
        fmt={fmt}
        onPrint={printTicket}
        onNewSale={newSale}
      />

      {/* MODAL REMBOURSEMENT (manager/admin) */}
      <RefundModal
        sale={refundSale}
        onClose={() => setRefundSale(null)}
        onConfirm={doRefund}
        saving={refunding}
        lang={lang}
        fmt={fmt}
      />

      {/* MODAL CLÔTURE JOURNALIÈRE — Ticket Z (manager/admin) */}
      {showTicketZ && <TicketZModal onClose={() => setShowTicketZ(false)} />}

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
            fontWeight: 'var(--fw-bold)',
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
