import { useState, useEffect, useMemo, useRef, lazy, Suspense, useCallback } from 'react'
import QRCode from 'qrcode'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore, useFormatAmount, useConvertToXOF, useConvertFromXOF, useCurrencyInfo, useCashierIsOpen, t, formatInCurrency } from '@/stores/appStore'
import { useAuthStore } from '@/stores/authStore'
import { salesApi, productsApi, whatsappApi, loyaltyApi, mtnMomoApi, campayApi, tenantApi, paydunyaApi } from '@/lib/api'
import { resolveTierPrice, isPromotionActive } from '@/lib/pricing'
import { barcodeMatches, matchesScannedCode } from '@/lib/barcode'
// Chargé à la demande (114 kB gz / @zxing) — uniquement à l'ouverture du scanner
const BarcodeScanner = lazy(() => import('@/components/ui/BarcodeScanner'))
import { ShoppingCart, Loader2, Search, Barcode, WifiOff, History, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { announce } from '@/lib/announce'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

import POSProductGrid from '@/components/pos/POSProductGrid'
import POSCart from '@/components/pos/POSCart'
import POSModals from '@/components/pos/POSModals'
import POSCashierClosed from '@/components/pos/POSCashierClosed'
import RefundModal from '@/components/pos/RefundModal'
import TicketZModal from '@/components/pos/TicketZModal'
import POSSuccessModal from '@/components/pos/POSSuccessModal'
import POSPaydunyaOverlay from '@/components/pos/POSPaydunyaOverlay'
import { printTicket as buildAndPrintTicket } from '@/components/pos/posTicket'
import { type PosProduct, type DiscountForm, CASHIER_TEXTS, computePosVat, toPosProduct } from '@/components/pos/posShared'
import { reconcileSaleTotal, authoritativeTotal, detectCartPriceDrift, toSaleItemPayload } from '@/components/pos/saleReconcile'
import { resolveScannedCode } from '@/components/pos/scanResolve'
import { freshnessAge, freshnessLabel, oldestFreshness } from '@/lib/dataFreshness'

export default function POS() {
  const {
    lang, currency,
    cashierOpenedAt,
    cashierOpeningFund, cashierSessionTx, cashierSessionCA,
    openCashier, closeCashier, addCashierSale,
    posTaxRate, posShowStockOnTile, posDefaultFund,
    posDefaultPayment, priceMode, posAutoprint, requireCashier,
    enableScanner: posEnableScanner, autoWhatsApp: posAutoWhatsApp, enableLoyalty,
    // Panier persisté dans le store (survit nav + refresh)
    cart, addCartItem, updateCartQty, setCart, clearCart,
    updateConfig,
    // Fraîcheur des données (Chantier B) : horodatage à chaque synchro réussie.
    freshness, markFresh, catalogNonce,
  } = useAppStore()
  const fmt    = useFormatAmount()
  const toXOF  = useConvertToXOF()
  const fromXOF = useConvertFromXOF()
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

  // Chargement des produits — extrait en callback pour pouvoir RAFRAÎCHIR le stock après une vente
  // (sinon l'UI affiche un stock périmé alors que le backend l'a bien décrémenté).
  const loadProducts = useCallback(() => {
    return productsApi.list()
      .then(data => {
        setPosProducts(data.map(toPosProduct))
        // Le catalogue vient du serveur → la classe « catalogue/prix » est fraîche.
        // Horodaté SEULEMENT en cas de succès : un échec réseau ne rajeunit rien.
        markFresh('catalog')
      })
      .catch(() => {})
  }, [markFresh])

  useEffect(() => {
    loadProducts().finally(() => setLoadingProducts(false))
  }, [loadProducts])

  // Rafraîchissement MANUEL depuis l'indicateur de synchro : la liste en mémoire suit,
  // sinon on afficherait « à jour » devant un écran resté périmé. (Le nonce démarre à 0
  // et le montage a déjà chargé → on saute la première valeur.)
  const firstNonce = useRef(true)
  useEffect(() => {
    if (firstNonce.current) { firstNonce.current = false; return }
    void loadProducts()
  }, [catalogNonce, loadProducts])


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

  // Panier vidé (ouverture de caisse, dernier article retiré, reset) → on réinitialise les états
  // de paiement LOCAUX (montant reçu + split). Sinon « Montant reçu » / « Monnaie à rendre »
  // (dérivée de cashGiven) gardent les valeurs de la session/vente précédente. openCashier() vide
  // le cart côté store mais ne peut pas toucher ces useState locaux → ce useEffect fait le pont.
  useEffect(() => {
    if (cart.length === 0) {
      setCashGiven('')
      setMixedAmt1('')
      setMixedOn(false)
    }
  }, [cart.length])

  // Client lié (via « Nouvelle vente » depuis la fiche client) → fidélité v2 (remise + points).
  const location = useLocation()
  // Client lié : initialisé depuis nav-state (« Nouvelle vente » fiche client) PUIS settable via le
  // sélecteur inline du panier (recherche texte ou scan QR carte fidélité).
  const [linkedCustomer, setLinkedCustomer] = useState<{ id: string; name: string } | null>(() => ((location.state as any)?.customer ?? null))
  const [loyaltyPct, setLoyaltyPct] = useState(0)  // % remise du palier du client lié (0 si N/A)
  const [loyaltyTier, setLoyaltyTier] = useState('')  // palier du client lié (chip sélecteur)
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null)  // solde points (puce panier — spec item 11)
  useEffect(() => {
    if (!linkedCustomer?.id || !enableLoyalty) { setLoyaltyPct(0); setLoyaltyTier(''); setLoyaltyPoints(null); return }
    loyaltyApi.get(linkedCustomer.id).then(d => {
      const pct = d.tier === 'Gold' ? (d.goldDiscount ?? 0) : d.tier === 'Silver' ? (d.silverDiscount ?? 0) : (d.bronzeDiscount ?? 0)
      setLoyaltyPct(Number(pct) || 0)
      setLoyaltyTier(d.tier ?? '')
      setLoyaltyPoints(Number.isFinite(d.points) ? d.points : null)
    }).catch(() => { setLoyaltyPct(0); setLoyaltyTier(''); setLoyaltyPoints(null) })
  }, [linkedCustomer?.id, enableLoyalty])
  const [showModal, setShowModal] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [clientType, setClientType] = useState<'retail'|'wholesale'|'semi'>('retail')
  const [discount, setDiscount] = useState<{ type:'percent'|'amount'; value:number; reason:string } | null>(null)
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [discountForm, setDiscountForm] = useState<DiscountForm>({ type:'percent' as 'percent'|'amount', value:0, reason:'' })
  const [isSaving, setIsSaving] = useState(false)
  // ── MTN MoMo POS ──────────────────────────────────────────────────────────
  const [mtnPhone, setMtnPhone]   = useState('')
  const [mtnStatus, setMtnStatus] = useState<'idle'|'requesting'|'polling'|'success'|'failed'|'timeout'>('idle')
  const [mtnReferenceId, setMtnReferenceId] = useState<string|null>(null)
  const [mtnError, setMtnError]   = useState('')
  const mtnReferenceIdRef = useRef<string|null>(null)
  // ── Orange Money (Campay) POS ──────────────────────────────────────────────
  const [orangePhone, setOrangePhone]     = useState('')
  const [orangeStatus, setOrangeStatus]   = useState<'idle'|'requesting'|'polling'|'success'|'failed'|'timeout'>('idle')
  const [orangeReference, setOrangeReference] = useState<string|null>(null)
  const [orangeError, setOrangeError]     = useState('')
  const orangeReferenceRef = useRef<string|null>(null)
  // ── Carte Campay (QR / lien hébergé Visa-Mastercard) ──────────────────────
  const [cardStatus, setCardStatus]         = useState<'idle'|'requesting'|'polling'|'success'|'failed'|'timeout'>('idle')
  const [cardPaymentUrl, setCardPaymentUrl] = useState<string|null>(null)
  const [cardReference, setCardReference]   = useState<string|null>(null)
  const [cardQrDataUrl, setCardQrDataUrl]   = useState<string|null>(null)
  const cardReferenceRef = useRef<string|null>(null)
  // ── PayDunya (Wave / Orange Money Sénégal & UEMOA) — flux hébergé QR + polling ──
  const [paydunyaOk, setPaydunyaOk]             = useState(false)  // backend configuré ?
  const [paydunyaStatus, setPaydunyaStatus]     = useState<'idle'|'requesting'|'polling'|'success'|'failed'|'timeout'>('idle')
  const [paydunyaUrl, setPaydunyaUrl]           = useState<string|null>(null)
  const [paydunyaQrDataUrl, setPaydunyaQrDataUrl] = useState<string|null>(null)
  const paydunyaTokenRef = useRef<string|null>(null)
  const [posTab, setPosTab] = useState<'pos'|'history'>('pos')
  const [showTicketZ, setShowTicketZ] = useState(false)
  const [salesHistory, setSalesHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  // Remboursement : réservé MANAGER + ADMIN (anti-fraude). Le caissier ne voit pas l'action.
  const canRefund = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(user?.role ?? '')
  const [refundSale, setRefundSale] = useState<any | null>(null)
  // Audit des ÉCARTS de prix : ADMIN uniquement (ni MANAGER ni CASHIER). Un écart peut trahir
  // une tentative du caissier → ne pas lui montrer ce qui est marqué (sinon il apprend le seuil).
  const canAuditPrices = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '')
  const [histDivergenceOnly, setHistDivergenceOnly] = useState(false)
  const toggleDivergenceFilter = (v: boolean) => { setHistDivergenceOnly(v); fetchHistory(v) }
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
  // Spec item 11 : < 900px → panier en vue dédiée (feuille/plein écran)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900)
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products')

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── Réseau (spec item 11) : indicateur header + cash-only hors-ligne ──
  // Source de vérité partagée (ping backend) — même signal que le badge global.
  const isOnline = useOnlineStatus()
  // Hors-ligne : Mobile Money / Carte indisponibles (webhooks impossibles) → bascule UI sur Espèces.
  useEffect(() => {
    if (!isOnline && payMode !== 'cash') setPayMode('cash')
  }, [isOnline, payMode])
  // Changement d'état réseau annoncé aux lecteurs d'écran (jamais au premier rendu).
  const prevOnlineRef = useRef(isOnline)
  useEffect(() => {
    if (prevOnlineRef.current !== isOnline) {
      const backOnline = isOnline && !prevOnlineRef.current
      prevOnlineRef.current = isOnline
      // Déclencheur CIBLÉ (Chantier B) : le catalogue a pu bouger pendant la coupure.
      // UN refetch sur la TRANSITION, jamais de périodique — mesuré ~119 Mo/mois pour
      // 3 terminaux en 2G, à transporter zéro changement l'écrasante majorité du temps.
      // On se greffe sur la transition DÉJÀ détectée ici : un seul détecteur, pas deux.
      if (backOnline) void loadProducts()
      announce(isOnline
        ? (lang === 'en' ? 'Back online' : lang === 'es' ? 'De nuevo en línea' : lang === 'it' ? 'Di nuovo online' : 'Connexion rétablie')
        : (lang === 'en' ? 'Offline — cash only' : lang === 'es' ? 'Sin conexión — solo efectivo' : lang === 'it' ? 'Offline — solo contanti' : 'Hors-ligne — espèces uniquement'))
    }
  }, [isOnline, lang, loadProducts])

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

  const fetchHistory = async (divergenceOnly = histDivergenceOnly) => {
    setLoadingHistory(true)
    try {
      const data = await salesApi.list(divergenceOnly ? { priceDivergence: true } : undefined)
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

  // Scan : le cache local ne fait PAS autorité. S'il ne matche pas, on demande au
  // serveur AVANT de conclure (échéance bornée, fail-open) — le produit a pu être créé
  // depuis la dernière synchro. Aucun chemin ne bloque l'encaissement.
  const handleScan = async (raw: string) => {
    setShowScanner(false)
    // Résolution EXACTE (brique partagée) : code-barres canonique OU SKU exact
    // (étiquettes CODE128-sur-SKU). Pas de match par NOM ici : à la caisse un faux
    // positif (mauvais produit ajouté) coûte plus cher qu'un échec de scan.
    const res = await resolveScannedCode<PosProduct>(
      raw,
      posProducts,
      (p, code) => matchesScannedCode(p, code) || String(p.id) === code,
      async (code) => {
        const p = await productsApi.lookup(code)
        return p ? toPosProduct(p) : null
      },
    )
    if (res.kind !== 'unresolved') {
      addItem(res.product)
      toast.success(`${res.product.name} scanné`)
      // Résolu par le serveur ⇒ le cache local était en retard : on le resynchronise
      // en tâche de fond, sans rien dire au caissier (rien n'a échoué de son point de vue).
      if (res.kind === 'remote') void loadProducts()
      return
    }
    // Ni local, ni serveur : on ne dit QUE ce qu'on sait.
    const oldest = oldestFreshness(freshness)
    const age = oldest && !oldest.neverSynced ? freshnessAge(oldest.at, Date.now()) : null
    toast.error(
      `${lang === 'en' ? 'Not in your local catalogue' : lang === 'es' ? 'No está en su catálogo local' : lang === 'it' ? 'Non è nel tuo catalogo locale' : 'Introuvable dans votre catalogue local'} (${lang === 'en' ? 'last sync' : lang === 'es' ? 'última sincronización' : lang === 'it' ? 'ultima sincronizzazione' : 'dernière synchro'} : ${freshnessLabel(age, lang)})`,
      { id: 'scan-unresolved', duration: 6000 },
    )
  }

  // ─── CAISSE (état local uniquement pour l'input) ─
  const [openingFundInput, setOpeningFundInput] = useState(() => posDefaultFund > 0 ? String(posDefaultFund) : '')
  const [showCloseModal, setShowCloseModal]     = useState(false)

  // ⚠️ requireCashier est PERSISTÉ dans localStorage et n'est resynchronisé depuis le backend que
  // lorsqu'on ouvre les Réglages → au refresh il peut être STALE (ex. true alors que la DB dit false).
  // On refetch le réglage autoritaire du tenant au montage et on n'évalue la gate qu'une fois chargé
  // (`settingsLoaded`) → sinon on afficherait « Caisse fermée » sur une valeur périmée.
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  useEffect(() => {
    let alive = true
    tenantApi.get()
      .then((t: any) => { if (alive && t) updateConfig({ requireCashier: t.requireCashier ?? false }) })
      .catch(() => {}) // hors-ligne / erreur → on retombe sur la valeur persistée
      .finally(() => { if (alive) setSettingsLoaded(true) })
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // État d'ouverture effectif (sélecteur partagé — même source de vérité que la Sidebar).
  const cashierIsOpen = useCashierIsOpen()

  // Toggle « Envoyer le ticket WhatsApp » : reflète le réglage tenant `autoWhatsApp` à CHAQUE
  // ouverture du modal de confirmation (et non un instantané figé au montage de la page, qui pouvait
  // rester ON après un changement de réglage). autoWhatsApp=false (défaut démo) → toggle OFF.
  useEffect(() => {
    if (showModal) setSendWhatsApp(posAutoWhatsApp)
  }, [showModal, posAutoWhatsApp])

  // À l'ouverture de la feuille d'encaissement : rafraîchit le catalogue en tâche de fond
  // (best-effort, JAMAIS bloquant). Le caissier choisit son mode de paiement pendant ce temps ;
  // si un tarif a changé depuis le montage, le refresh met à jour productById → la dérive de
  // prix (ci-dessous) se révèle AVANT l'encaissement. S'il ne répond pas à temps (cold start
  // Railway), rien n'est bloqué : la réconciliation post-vente (reconcileSaleTotal) prend le relais.
  useEffect(() => {
    if (showModal) void loadProducts()
  }, [showModal, loadProducts])

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
  // La promo n'est prise en compte que si elle n'est pas EXPIRÉE (échéance inclusive) —
  // sinon la tuile et le panier afficheraient un prix promo que le backend ne facture plus.
  const computePriceForItem = (p: PosProduct, qty: number): { price: number; tierLabel?: string } => {
    const basePrice = getBasePrice(p)
    const promoActive = isPromotionActive(p.promotion, p.promotionEnd, new Date())
    return resolveTierPrice(qty, basePrice, p.priceTiers ?? null, { active: promoActive, price: p.promotionPrice })
  }
  // Compat : getPrice(p) = qty=1 (utilisé pour affichage prix sur la tuile produit)
  const getPrice = (p: PosProduct) => computePriceForItem(p, 1).price

  // Filtrage produits — mémoïsé : recalculé seulement quand produits/catégorie/recherche changent
  const filtered = useMemo(() => posProducts.filter(p =>
    (activeCat === 'all' || p.cat === activeCat) &&
    // Recherche : nom + SKU (imprimé sur les étiquettes) + code-barres (règle canonique)
    (!search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
      barcodeMatches(p.barcode, search))
  ), [posProducts, activeCat, search])

  // Index produits par id pour recalcul rapide
  const productById = useMemo(
    () => new Map<number | string, PosProduct>(posProducts.map(p => [p.id, p] as [number | string, PosProduct])),
    [posProducts],
  )

  // Dérive de prix PRÉ-vente : le prix figé de chaque ligne du panier vs le prix FRAIS du
  // catalogue (rafraîchi à l'ouverture de la feuille). Recalculée quand le panier OU le
  // catalogue OU le type de client change. Vide tant que rien n'a bougé → aucune alerte.
  const priceDrift = useMemo(
    () => detectCartPriceDrift(cart, (id, qty) => {
      const p = productById.get(id)
      return p ? computePriceForItem(p, qty) : null
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart, productById, clientType],
  )
  // Applique les prix frais aux lignes concernées — action EXPLICITE du caissier (bouton),
  // jamais une mutation silencieuse : delta 0 = on ne touche que le prix + le tierLabel.
  const applyPriceDrift = () => {
    // Les prix frais sortent de computePriceForItem, donc du tarif COURANT : la ligne
    // adopte ce tarif en même temps que le prix (sinon elle déclarerait l'ancien).
    for (const d of priceDrift) updateCartQty(d.id, 0, d.newPrice, d.tierLabel ?? undefined, clientType)
  }

  // Actions panier — calcul price+tierLabel via computePriceForItem (logique métier
  // qui dépend de clientType + promo + tiers), puis délégation au store pour mutation.
  const addItem = (p: PosProduct) => {
    const existing = cart.find(i => i.id === p.id)
    const newQty = existing ? existing.qty + 1 : 1
    if (p.stock > 0 && newQty > p.stock) return // cap anti-survente
    const { price, tierLabel } = computePriceForItem(p, newQty)
    if (existing) {
      // produit déjà au panier → +1 et recalcule price (utile si on franchit un palier)
      updateCartQty(p.id, 1, price, tierLabel, clientType)
    } else {
      addCartItem({ id: p.id, name: p.name, price, qty: 1, emoji: p.emoji, tierLabel, clientType })
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
    if (delta > 0 && product.stock > 0 && newQty > product.stock) return // cap anti-survente
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
    updateCartQty(id, delta, price, tierLabel, clientType)
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

  // Total réellement FACTURÉ par le serveur pour la vente en cours (null tant qu'il n'a pas
  // répondu). En `ref` et non en state : `printTicket` est appelé dans la même passe que
  // l'enregistrement, un state n'y serait pas encore à jour — et garder la signature à zéro
  // argument évite le piège `onPrint={printTicket}` qui passerait l'événement en 1er argument.
  const billedTotalRef = useRef<number | null>(null)
  const printTicket = () => buildAndPrintTicket({
    lang, locale, cart, discount, discountAmount,
    // Le serveur fait foi : sinon le ticket papier remis en main propre contredit la facture PDF.
    totalHT, tva, posTaxRate, total: billedTotalRef.current ?? netTotal, payMode, cashGiven, currency, monnaie, fmt,
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

  const handleOrangePhone = (v: string) => { setOrangePhone(v); if (orangeError) setOrangeError('') }

  const onOrangeRetry = () => {
    setOrangePhone('')
    setOrangeStatus('idle')
    setOrangeError('')
    orangeReferenceRef.current = null
    setOrangeReference(null)
  }

  const normalizeOrangePhone = (raw: string): string | null => {
    const s = raw.replace(/[\s\-\(\)]/g, '')
    if (/^\+237[0-9]{9}$/.test(s)) return s.slice(1)
    if (/^237[0-9]{9}$/.test(s))   return s
    if (/^6[0-9]{8}$/.test(s))     return `237${s}`
    const d = s.replace(/^\+/, '')
    if (/^[0-9]{8,15}$/.test(d))   return d
    return null
  }

  const startOrangePayment = async () => {
    setOrangeError('')
    const phone = normalizeOrangePhone(orangePhone)
    if (!phone) {
      setOrangeError(
        lang === 'en' ? 'Enter a valid number (8–15 digits, e.g. 699000000)' :
        lang === 'es' ? 'Ingrese un número válido (8–15 dígitos, ej: 699000000)' :
        lang === 'it' ? 'Inserire un numero valido (8–15 cifre, es: 699000000)' :
        'Saisissez un numéro valide (8–15 chiffres, ex: 699000000)',
      )
      return
    }
    setOrangeStatus('requesting')
    try {
      const { reference } = await campayApi.request({ amount: netTotal, phoneNumber: phone, operator: 'orange' })
      orangeReferenceRef.current = reference
      setOrangeReference(reference)
      setOrangeStatus('polling')
    } catch {
      setOrangeStatus('failed')
      toast.error(
        lang === 'en' ? 'Orange Money request failed — retry' :
        lang === 'es' ? 'Error Orange Money — reintente' :
        lang === 'it' ? 'Errore Orange Money — riprova' :
        'Échec de la demande Orange Money — réessayez',
      )
    }
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

  // Polling Orange Money 3s, max 40 tours (2 min)
  useEffect(() => {
    if (orangeStatus !== 'polling') return
    let done = false
    let count = 0
    const MAX = 40
    const poll = async () => {
      if (done) return
      count++
      if (count > MAX) { done = true; setOrangeStatus('timeout'); return }
      try {
        const ref = orangeReferenceRef.current
        if (!ref) return
        const res = await campayApi.status(ref)
        if (res.status === 'SUCCESSFUL') { done = true; setOrangeStatus('success') }
        else if (res.status === 'FAILED') { done = true; setOrangeStatus('failed') }
      } catch { /* fail-silent */ }
    }
    const timer = setInterval(poll, 3000)
    return () => { done = true; clearInterval(timer) }
  }, [orangeStatus])

  // Déclenche confirmSale dès que Orange passe à 'success'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (orangeStatus === 'success') confirmSale(undefined, orangeReferenceRef.current ?? undefined)
  }, [orangeStatus]) // intentionally omits confirmSale (fresh via post-render execution)

  // Réinitialise le flux Orange quand on change de mode de paiement
  useEffect(() => {
    if (payMode !== 'orange') {
      setOrangePhone('')
      setOrangeStatus('idle')
      setOrangeReference(null)
      orangeReferenceRef.current = null
    }
  }, [payMode])

  // ── Carte Campay ────────────────────────────────────────────────────────────
  const onCardRetry = () => {
    setCardStatus('idle')
    setCardPaymentUrl(null)
    setCardQrDataUrl(null)
    setCardReference(null)
    cardReferenceRef.current = null
  }

  const startCardPayment = useCallback(async () => {
    setCardStatus('requesting')
    try {
      const { paymentUrl, reference } = await campayApi.cardLink({ amount: netTotal })
      cardReferenceRef.current = reference
      setCardReference(reference)
      setCardPaymentUrl(paymentUrl)
      setCardStatus('polling')
    } catch {
      setCardStatus('failed')
      toast.error(
        lang === 'en' ? 'Card payment request failed — retry' :
        lang === 'es' ? 'Error de pago con tarjeta — reintente' :
        lang === 'it' ? 'Errore pagamento carta — riprova' :
        'Échec de la demande de paiement carte — réessayez',
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netTotal, lang])

  // Génère le QR dès qu'une URL de paiement est disponible
  useEffect(() => {
    if (!cardPaymentUrl) { setCardQrDataUrl(null); return }
    QRCode.toDataURL(cardPaymentUrl, { width: 160, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(url => setCardQrDataUrl(url))
      .catch(() => setCardQrDataUrl(null))
  }, [cardPaymentUrl])

  // Polling carte 3s, max 40 tours (2 min)
  useEffect(() => {
    if (cardStatus !== 'polling') return
    let done = false
    let count = 0
    const MAX = 40
    const poll = async () => {
      if (done) return
      count++
      if (count > MAX) { done = true; setCardStatus('timeout'); return }
      try {
        const ref = cardReferenceRef.current
        if (!ref) return
        const res = await campayApi.status(ref)
        if (res.status === 'SUCCESSFUL') { done = true; setCardStatus('success') }
        else if (res.status === 'FAILED') { done = true; setCardStatus('failed') }
      } catch { /* fail-silent */ }
    }
    const timer = setInterval(poll, 3000)
    return () => { done = true; clearInterval(timer) }
  }, [cardStatus])

  // Déclenche confirmSale dès que la carte passe à 'success'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (cardStatus === 'success') confirmSale(undefined, cardReferenceRef.current ?? undefined)
  }, [cardStatus]) // intentionally omits confirmSale (fresh via post-render execution)

  // Réinitialise le flux carte quand on change de mode de paiement
  useEffect(() => {
    if (payMode !== 'card') {
      setCardStatus('idle')
      setCardPaymentUrl(null)
      setCardQrDataUrl(null)
      setCardReference(null)
      cardReferenceRef.current = null
    }
  }, [payMode])

  // ── PayDunya : disponibilité (config backend) chargée une fois au montage ──
  useEffect(() => {
    paydunyaApi.config().then(c => setPaydunyaOk(!!c?.configured)).catch(() => setPaydunyaOk(false))
  }, [])

  const onPaydunyaCancel = () => {
    setPaydunyaStatus('idle')
    setPaydunyaUrl(null)
    setPaydunyaQrDataUrl(null)
    paydunyaTokenRef.current = null
  }

  // Lance le paiement PayDunya (Wave / Orange Money) : crée la facture hébergée → polling.
  const startPaydunyaPayment = useCallback(async () => {
    setPaydunyaStatus('requesting')
    try {
      const { token, redirectUrl } = await paydunyaApi.initiate({ amount: Math.round(netTotal) })
      paydunyaTokenRef.current = token
      setPaydunyaUrl(redirectUrl)
      setPaydunyaStatus('polling')
    } catch {
      setPaydunyaStatus('failed')
      toast.error(
        lang === 'en' ? 'PayDunya payment request failed — retry' :
        lang === 'es' ? 'Error de pago PayDunya — reintente' :
        lang === 'it' ? 'Errore pagamento PayDunya — riprova' :
        'Échec de la demande de paiement PayDunya — réessayez',
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netTotal, lang])

  // QR dès qu'une URL hébergée est dispo (noir/blanc opaque, scannable).
  useEffect(() => {
    if (!paydunyaUrl) { setPaydunyaQrDataUrl(null); return }
    QRCode.toDataURL(paydunyaUrl, { width: 180, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      .then(url => setPaydunyaQrDataUrl(url))
      .catch(() => setPaydunyaQrDataUrl(null))
  }, [paydunyaUrl])

  // Polling PayDunya 3s, max 100 tours (5 min — délai exigé par la spec).
  useEffect(() => {
    if (paydunyaStatus !== 'polling') return
    let done = false
    let count = 0
    const MAX = 100
    const poll = async () => {
      if (done) return
      count++
      if (count > MAX) { done = true; setPaydunyaStatus('timeout'); return }
      try {
        const token = paydunyaTokenRef.current
        if (!token) return
        const res = await paydunyaApi.status(token)
        if (res.status === 'completed') { done = true; setPaydunyaStatus('success') }
        else if (res.status === 'cancelled' || res.status === 'failed') { done = true; setPaydunyaStatus('failed') }
      } catch { /* fail-silent */ }
    }
    const timer = setInterval(poll, 3000)
    return () => { done = true; clearInterval(timer) }
  }, [paydunyaStatus])

  // Finalise la vente quand PayDunya passe à 'success' (même flux qu'Espèces/Carte).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (paydunyaStatus === 'success') confirmSale(undefined, undefined, paydunyaTokenRef.current ?? undefined)
  }, [paydunyaStatus]) // omet confirmSale volontairement (closure fraîche au post-rendu)

  const confirmSale = async (mtnRef?: string, campayRef?: string, paydunyaRef?: string) => {
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
    // Vente telle que le SERVEUR l'a enregistrée. Sa réponse était jetée : le serveur peut
    // avoir re-tarifé (catalogue du terminal périmé) et facturé un autre montant que celui
    // encaissé — cf. saleReconcile.ts.
    let createdSale: unknown = null
    billedTotalRef.current = null // repart à zéro : ne jamais réutiliser le total d'une vente précédente
    try {
      createdSale = await salesApi.create({
        items: toSaleItemPayload(cart),
        paymentMode: mixedOn ? 'mixed' : payMode,
        total,  // BRUT — le backend applique la remise fidélité (Modèle A) → sale.total = net
        customerId: linkedCustomer?.id ?? null,
        discount: discount ? { type: discount.type, amount: discountAmount } : null,
        ...(mixedOn ? mixedSplit : {}),
        mtnMomoReference: mtnRef ?? null,
        campayReference: campayRef ?? null,
        paydunyaReference: paydunyaRef ?? null,
      })
    } catch (err: any) {
      // Échec serveur (stock insuffisant, réseau, validation…) → on SURFACE l'erreur et on AVORTE.
      // (Plus de fallback « hors-ligne » : il n'y a pas de persistance locale des ventes.)
      toast.error(err?.message || (lang === 'en' ? 'Sale failed' : lang === 'es' ? 'Venta fallida' : lang === 'it' ? 'Vendita fallita' : 'Échec de la vente'))
      setIsSaving(false)
      return
    }

    // Rafraîchit le catalogue → le stock affiché reflète la décrémentation serveur, ET le
    // prochain encaissement repart de tarifs frais (un tarif changé ne mord qu'une vente).
    void loadProducts()

    // ── Réconciliation : le serveur fait foi sur ce qui a été FACTURÉ ──────────────
    // S'il a re-tarifé, la caisse est courte (ou longue) d'un montant que personne ne voyait
    // avant la clôture. On le dit MAINTENANT, tant que le client est encore au comptoir.
    const serverTotal = (createdSale as { total?: unknown } | null)?.total
    const billedTotal = authoritativeTotal(serverTotal, netTotal)
    billedTotalRef.current = billedTotal // ticket imprimé + reçu WhatsApp : le serveur fait foi
    const gap = reconcileSaleTotal(serverTotal, netTotal)
    if (gap) {
      const amount = fmt(Math.abs(gap.gap))
      const msg = gap.action === 'claim'
        ? (lang === 'en' ? `Price changed — billed ${fmt(billedTotal)}. Claim ${amount} from the customer.`
        :  lang === 'es' ? `La tarifa cambió — facturado ${fmt(billedTotal)}. Reclame ${amount} al cliente.`
        :  lang === 'it' ? `La tariffa è cambiata — fatturato ${fmt(billedTotal)}. Richiedi ${amount} al cliente.`
        :  `Le tarif a changé — facturé ${fmt(billedTotal)}. Réclamer ${amount} au client.`)
        : (lang === 'en' ? `Price changed — billed ${fmt(billedTotal)}. Give ${amount} back to the customer.`
        :  lang === 'es' ? `La tarifa cambió — facturado ${fmt(billedTotal)}. Devuelva ${amount} al cliente.`
        :  lang === 'it' ? `La tariffa è cambiata — fatturato ${fmt(billedTotal)}. Restituisci ${amount} al cliente.`
        :  `Le tarif a changé — facturé ${fmt(billedTotal)}. Rendre ${amount} au client.`)
      // Durée longue + annonce : c'est de l'argent, ça ne doit pas filer sous les yeux.
      toast.error(msg, { duration: 15000 })
      announce(msg)
    }

    // Envoi WhatsApp si activé
    const fullPhone = waNumber.trim() ? `${waCountryCode}${waNumber.replace(/[\s\-]/g, '')}` : ''
    if (sendWhatsApp && fullPhone) {
      setWaSending(true)
      try {
        await whatsappApi.sendTicket({
          phone:       fullPhone,
          items:       cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
          // Total SERVEUR (net). L'ancien `total` était le BRUT : le reçu ignorait la remise
          // fidélité, et contredisait la facture PDF dès que le serveur avait re-tarifé.
          total:       Math.round(billedTotal),
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
    setOrangePhone('')
    setOrangeStatus('idle')
    setOrangeError('')
    setOrangeReference(null)
    orangeReferenceRef.current = null
    setCardStatus('idle')
    setCardPaymentUrl(null)
    setCardQrDataUrl(null)
    setCardReference(null)
    cardReferenceRef.current = null
    setPaydunyaStatus('idle')
    setPaydunyaUrl(null)
    setPaydunyaQrDataUrl(null)
    paydunyaTokenRef.current = null
  }

  // ─── RENDER ──────────────────────────────

  // Tant que le réglage tenant autoritaire (requireCashier) n'est pas confirmé depuis l'API,
  // on affiche un loader NEUTRE plutôt que « Caisse fermée » sur une valeur persistée potentiellement périmée.
  if (!settingsLoaded) {
    return (
      <div role="status" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'calc(100vh - 54px)', gap:10, color:'var(--text3)' }}>
        <Loader2 size={24} style={{ animation:'spin 1s linear infinite', color:'var(--p)', flexShrink:0 }} />
        <span style={{ fontSize:14 }}>{lang==='en' ? 'Loading…' : lang==='es' ? 'Cargando…' : lang==='it' ? 'Caricamento…' : 'Chargement…'}</span>
      </div>
    )
  }

  // Caisse fermée (après reconnexion ou fermeture explicite) → écran d'ouverture.
  // - requireCashier=true  → cérémonie avec saisie du fond de caisse (fond stocké en XOF).
  // - requireCashier=false → bouton « Ouvrir » seul (sans formulaire de fond), ouverture à 0.
  if (!cashierIsOpen) {
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
        showFundInput={requireCashier}
        onOpen={() => {
          // requireCashier=true : `inputValue` est en devise d'AFFICHAGE → stocké en XOF (comme cashierSessionCA).
          // requireCashier=false : ouverture simple, fond à 0.
          openCashier(requireCashier ? toXOF(inputValue) : 0)
          toast.success(`${ct.cashier_label} ouverte${requireCashier ? ` — Fond: ${displayFund}` : ''}`)
        }}
      />
    )
  }

  return (
    <>
      {/* PAGE WRAPPER — colonne : barre POS puis les 2 colonnes catalogue/panier.
          .pos-fullbleed : neutralise padding/scroll du .page-content (cf. index.css). */}
      <div className="pos-fullbleed" style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 54px)',
        overflow: 'hidden',
        background: 'var(--bg)',
        gap: 0,
      }}>

        {/* ── HEADER POS UNIQUE — 1:1 maquette 01-pos-principal.view.html :
             [boutique] [pill caisse] [recherche+scan] [historique] [réseau].
             La pill caisse est le point d'entrée discret de la CLÔTURE (modale). ── */}
        <div data-testid="pos-header" style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          {/* Boutique active */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Store size={17} style={{ color: 'var(--p2)', flexShrink: 0 }} aria-hidden="true" />
            <span style={{
              color: 'var(--text)', fontSize: 14, fontWeight: 'var(--fw-semibold)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180,
            }}>{user?.shopName ?? ''}</span>
          </div>

          {/* Pill statut caisse — cliquable : ouvre la modale de fermeture */}
          <button type="button" data-testid="pos-cashier-pill"
            onClick={() => setShowCloseModal(true)}
            title={lang === 'en' ? 'Close the register' : lang === 'es' ? 'Cerrar la caja' : lang === 'it' ? 'Chiudi la cassa' : 'Fermer la caisse'}
            aria-label={lang === 'en' ? 'Register open — close the register' : lang === 'es' ? 'Caja abierta — cerrar la caja' : lang === 'it' ? 'Cassa aperta — chiudi la cassa' : 'Caisse ouverte — fermer la caisse'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '4px 10px', borderRadius: 'var(--r-full)',
              background: 'var(--c-green-bg)', border: '1px solid var(--c-green-border)',
              color: 'var(--acc2)', fontSize: 12, fontWeight: 'var(--fw-semibold)',
              cursor: 'pointer', fontFamily: 'var(--font)',
            }}>
            <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acc2)' }} />
            {lang === 'en' ? 'Register open' : lang === 'es' ? 'Caja abierta' : lang === 'it' ? 'Cassa aperta' : 'Caisse ouverte'}
          </button>

          {/* Recherche + scan — icône code-barres DANS le champ (maquette) */}
          {posTab === 'pos' ? (
            <div style={{ flex: 1, minWidth: 180, maxWidth: 360, position: 'relative' }}>
              <Search size={15} style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text3)', pointerEvents: 'none',
              }} />
              <input
                className="input"
                style={{ paddingLeft: 36, paddingRight: posEnableScanner ? 46 : 12, width: '100%', fontSize: 13, minHeight: 40, boxSizing: 'border-box' }}
                aria-label={t('pos_search')}
                // Placeholder honnête : ne promet « …ou scanner » QUE si le scan est activé
                // pour le tenant (Réglages → POS). Sinon l'affordance n'existe pas → « Rechercher… ».
                placeholder={posEnableScanner
                  ? (lang === 'en' ? 'Search or scan…' : lang === 'es' ? 'Buscar o escanear…' : lang === 'it' ? 'Cerca o scansiona…' : 'Rechercher ou scanner…')
                  : (lang === 'en' ? 'Search…' : lang === 'es' ? 'Buscar…' : lang === 'it' ? 'Cerca…' : 'Rechercher…')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {/* Scan produit — même handler que le scanner plein écran (handleScan), pas de
                  duplication de logique. Cible ≥ 44px (déborde le champ de 40px sans le
                  déformer, fond transparent), focus-visible via la règle globale. */}
              {posEnableScanner && (
                <button
                  onClick={() => setShowScanner(true)}
                  aria-label={lang === 'en' ? 'Scan a barcode' : lang === 'es' ? 'Escanear un código de barras' : lang === 'it' ? 'Scansiona un codice a barre' : 'Scanner un code-barres'}
                  title={lang === 'en' ? 'Scan a barcode' : lang === 'es' ? 'Escanear un código de barras' : lang === 'it' ? 'Scansiona un codice a barre' : 'Scanner un code-barres'}
                  style={{
                    position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
                    width: 44, height: 44, borderRadius: 8,
                    cursor: 'pointer', transition: 'all .15s',
                    background: 'transparent', border: 'none',
                    color: 'var(--p2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                ><Barcode size={17} /></button>
              )}
            </div>
          ) : (
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 'var(--fw-semibold)', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
              <History size={15} style={{ color: 'var(--text3)' }} aria-hidden="true" />
              {lang === 'en' ? 'Sales history' : lang === 'es' ? 'Historial de ventas' : lang === 'it' ? 'Storico vendite' : 'Historique des ventes'}
            </span>
          )}

          {/* Historique — action discrète, hors du flux caisse */}
          <button type="button"
            onClick={() => { const next = posTab === 'pos' ? 'history' : 'pos'; setPosTab(next); if (next === 'history') fetchHistory() }}
            aria-pressed={posTab === 'history'}
            aria-label={lang === 'en' ? 'History' : lang === 'es' ? 'Historial' : lang === 'it' ? 'Storico' : 'Historique'}
            title={lang === 'en' ? 'History' : lang === 'es' ? 'Historial' : lang === 'it' ? 'Storico' : 'Historique'}
            style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0, marginLeft: 'auto',
              cursor: 'pointer', fontFamily: 'var(--font)', transition: 'all .15s',
              background: posTab === 'history' ? 'var(--p)' : 'var(--card)',
              border: `1px solid ${posTab === 'history' ? 'var(--p)' : 'var(--border)'}`,
              color: posTab === 'history' ? '#fff' : 'var(--text2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><History size={16} /></button>

          {/* Badge réseau : UNIQUEMENT hors-ligne (cash-only) — l'état « En ligne »
              est déjà porté par la barre d'app (pas de doublon). */}
          {!isOnline && (
            <span data-testid="pos-network" role="status" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '4px 10px', borderRadius: 'var(--r-full)', fontSize: 12, fontWeight: 'var(--fw-semibold)',
              background: 'var(--c-amber-bg, rgba(255,197,61,.14))',
              border: '1px solid var(--c-amber-border, rgba(255,197,61,.3))',
              color: 'var(--warn)',
            }}>
              <WifiOff size={13} /> {lang === 'en' ? 'Offline' : lang === 'es' ? 'Sin conexión' : lang === 'it' ? 'Offline' : 'Hors-ligne'}
            </span>
          )}
        </div>

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
                {view === 'products'
                  ? (lang === 'en' ? 'Products' : lang === 'es' ? 'Productos' : lang === 'it' ? 'Prodotti' : 'Produits')
                  : `${t('pos_cart')} (${cart.length})`}
              </button>
            ))}
          </div>
        )}

        {/* ── 2 COLONNES (spec) : catalogue ~1.6fr · panier ~1fr min 270px ── */}
        <div style={{
          flex: 1, minHeight: 0,
          display: isMobile ? 'flex' : 'grid',
          flexDirection: 'column',
          gridTemplateColumns: '1.6fr minmax(270px, 1fr)',
        }}>

        {/* ════════════════════════════════
            COLONNE GAUCHE — CATALOGUE
        ════════════════════════════════ */}
        <POSProductGrid
          posTab={posTab}
          lang={lang}
          activeCat={activeCat} setActiveCat={setActiveCat}
          clientType={clientType} setClientType={setClientType}
          fmt={fmt}
          amountLabel={n => fromXOF(n).toLocaleString(locale, { maximumFractionDigits: 2 })}
          curSuffix={currencySymbol}
          filtered={filtered}
          cart={cart}
          addItem={addItem}
          getPrice={getPrice}
          posShowStockOnTile={posShowStockOnTile}
          loadingHistory={loadingHistory}
          salesHistory={salesHistory}
          canAuditPrices={canAuditPrices} divergenceOnly={histDivergenceOnly} onToggleDivergence={toggleDivergenceFilter}
          canRefund={canRefund} onRefundClick={setRefundSale}
          canCloseDay={canRefund} onCloseDay={() => setShowTicketZ(true)}
          isMobile={isMobile} mobileView={mobileView}
          totalProducts={posProducts.length} loadingProducts={loadingProducts}
          navigate={navigate}
        />

        {/* ════════════════════════════════
            COLONNE DROITE — PANIER
        ════════════════════════════════ */}
        <POSCart
          lang={lang}
          cart={cart} setCart={setCart}
          fmt={fmt}
          discount={discount} discountAmount={discountAmount}
          setShowDiscountModal={setShowDiscountModal} setDiscount={setDiscount}
          totalHT={totalHT} tva={tva} posTaxRate={posTaxRate} total={netTotal}
          loyaltyDiscount={loyaltyDiscount} loyaltyPct={loyaltyPct} loyaltyCustomerName={linkedCustomer?.name ?? null}
          linkedCustomer={linkedCustomer} setLinkedCustomer={setLinkedCustomer} enableLoyalty={enableLoyalty} loyaltyTier={loyaltyTier} loyaltyPoints={loyaltyPoints}
          setShowModal={setShowModal}
          updateQty={updateQty}
          isMobile={isMobile} mobileView={mobileView}
          getStock={id => productById.get(id)?.stock ?? 0}
        />
        </div>
      </div>

      {/* PayDunya — overlay QR + polling (Wave / Orange Money). Masqué quand la vente est confirmée. */}
      {paydunyaStatus !== 'idle' && !showSuccess && (
        <POSPaydunyaOverlay
          status={paydunyaStatus}
          method={payMode === 'orange' ? 'orange' : 'wave'}
          qrDataUrl={paydunyaQrDataUrl}
          paymentUrl={paydunyaUrl}
          amountLabel={fmt(netTotal)}
          lang={lang}
          onCancel={onPaydunyaCancel}
          onRetry={() => { onPaydunyaCancel(); startPaydunyaPayment() }}
        />
      )}

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
        cashierName={cashierName}
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
        discount={discount} payMode={payMode}
        cashGiven={cashGiven} toXOF={toXOF}
        PAY_MODES={PAY_MODES} setPayMode={setPayMode}
        isOnline={isOnline}
        setCashGiven={setCashGiven} monnaie={monnaie} currencySymbol={currencySymbol}
        mixedOn={mixedOn} mixedValid={mixedValid}
        setMixedOn={setMixedOn}
        mixedM1={mixedM1} setMixedM1={setMixedM1} mixedM2={mixedM2} setMixedM2={setMixedM2}
        mixedAmt1={mixedAmt1} setMixedAmt1={setMixedAmt1} mixedAmt2XOF={mixedAmt2XOF}
        paydunyaOk={paydunyaOk} onPaydunyaStart={startPaydunyaPayment}
        tvaAmount={tva} tvaRate={posTaxRate} totalDisplay={fromXOF(netTotal)}
        priceDrift={priceDrift} onApplyPriceDrift={applyPriceDrift}
        mtnPhone={mtnPhone} setMtnPhone={handleMtnPhone}
        mtnStatus={mtnStatus} mtnError={mtnError}
        startMtnPayment={startMtnPayment} onMtnRetry={onMtnRetry}
        orangePhone={orangePhone} setOrangePhone={handleOrangePhone}
        orangeStatus={orangeStatus} orangeError={orangeError}
        startOrangePayment={startOrangePayment} onOrangeRetry={onOrangeRetry}
        cardStatus={cardStatus} cardPaymentUrl={cardPaymentUrl} cardQrDataUrl={cardQrDataUrl}
        startCardPayment={startCardPayment} onCardRetry={onCardRetry}
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
