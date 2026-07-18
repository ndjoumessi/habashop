import { useState, useMemo, useCallback } from 'react'
import {
  View, Text, ScrollView,
  StyleSheet, Alert, Pressable,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { productsApi, customersApi, apiErrorMessage } from '@/services/api'
import type { Product, SalePayload, Customer } from '@/types'
import { matchCustomerByCode, extractDirectCustomerId } from '@/lib/customerQr'
import { submitSaleResilient, type SaleSubmitResult } from '@/services/saleSubmit'
import { newIdempotencyKey } from '@/lib/idempotency'
import type { MixedSplit } from '@/lib/paymentSplit'
import { usePosStore } from '@/stores/posStore'
import { useI18n, useFmt, useTheme, formatAmountParts, plural } from '@/stores/appStore'
import { loyaltyDiscountFor } from '@/lib/loyalty'
import {
  ThemeColors, Spacing, BorderRadius, FontSize, Shadow,
} from '@/constants/theme'
import { useAuthStore } from '@/stores/authStore'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { enqueueAction } from '@/services/offlineQueue'
import { convertToXOF } from '@/services/exchangeRate'
import { normalizeBarcode } from '@/lib/barcode'
import { sendWhatsAppTicket } from '@/services/whatsappTicket'
import { printReceipt } from '@/services/printReceipt'
import BarcodeScanner from '@/components/pos/BarcodeScanner'
import ErrorState from '@/components/ui/ErrorState'
import OfflineBanner from '@/components/ui/OfflineBanner'
import ScreenHeader from '@/components/ui/ScreenHeader'
import Chip from '@/components/ui/Chip'
import AccessibleButton from '@/components/ui/AccessibleButton'
import POSConfirmModal from '@/components/pos/POSConfirmModal'
import POSCart from '@/components/pos/POSCart'
import POSProductGrid from '@/components/pos/POSProductGrid'
import CustomerPicker from '@/components/pos/CustomerPicker'
import LoyaltyCardDigital from '@/components/customers/LoyaltyCardDigital'

// Boundary localisé de la Caisse : un crash POS affiche un fallback sans tuer la nav.
export { default as ErrorBoundary } from '@/components/ui/RouteErrorFallback'

// Délai laissant les modales (panier pageSheet + confirmation fade) se fermer AVANT de
// présenter l'alerte « reçu » : une Alert/print dialog native déclenchée pendant le
// teardown des Modal est avalée (rien ne s'affiche). Cf. bug impression post-refactor.
const ALERT_AFTER_MODAL_MS = 350

// ── Écran POS ────────────────────────────────────
export default function POSScreen() {
  const insets = useSafeAreaInsets()
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i, lang } = useI18n()
  const { fmt, currency, rates } = useFmt()
  // Prix bi-ton des tuiles (montant or + devise atténuée) — stable comme `fmt`.
  const fmtParts = useCallback((n: number) => formatAmountParts(n, currency, rates), [currency, rates])
  const { tenant } = useAuthStore()
  const { isOnline } = useNetworkStatus()
  const qc = useQueryClient()

  const cart           = usePosStore(st => st.cart)
  const addItem        = usePosStore(st => st.addItem)
  const removeItem     = usePosStore(st => st.removeItem)
  const updateQty      = usePosStore(st => st.updateQty)
  const clearCart      = usePosStore(st => st.clearCart)
  const customer       = usePosStore(st => st.customer)
  const setCustomer    = usePosStore(st => st.setCustomer)
  const discount       = usePosStore(st => st.discount)
  const setDiscount    = usePosStore(st => st.setDiscount)
  const paymentMode    = usePosStore(st => st.paymentMode)
  const setPaymentMode = usePosStore(st => st.setPaymentMode)
  const cashGiven      = usePosStore(st => st.cashGiven)
  const setCashGiven   = usePosStore(st => st.setCashGiven)
  const recordSale     = usePosStore(st => st.recordSale)
  const subtotal       = usePosStore(st => st.subtotal)
  const total          = usePosStore(st => st.total)

  const [activeCat, setActiveCat] = useState('all')
  const [showCart, setShowCart]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  // Mode du scanner : 'product' (code-barres → panier) ou 'customer' (QR carte → client lié).
  const [scanMode, setScanMode] = useState<'product' | 'customer'>('product')
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  // Ventilation mixte transmise par le panier → utilisée à la confirmation (sinon null = simple).
  const [pendingOverride, setPendingOverride] = useState<({ paymentMode: string } & MixedSplit) | null>(null)
  // Carte fidélité numérique proposée après une vente liée à un client (montée à la demande).
  const [loyaltyCardId, setLoyaltyCardId] = useState<string | null>(null)

  const { data: products = [], isLoading, isError, refetch } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn:  () => productsApi.list(),
    staleTime: 2 * 60 * 1000,
  })

  const active = useMemo(
    () => (products ?? []).filter((p) => p.isActive !== false),
    [products],
  )
  const categories = useMemo(
    () => Array.from(new Set(active.map((p) => p.category).filter(Boolean))) as string[],
    [active],
  )
  const filtered = useMemo(
    () => active.filter((p) => activeCat === 'all' || p.category === activeCat),
    [active, activeCat],
  )

  const totalQty   = cart.reduce((n, c) => n + c.quantity, 0)
  const totalAmt   = total()
  const subAmt     = subtotal()
  const discAmt    = subAmt - totalAmt
  // NET après remise fidélité (miroir backend) — le montant réellement dû. La garde
  // espèces doit comparer à CE net, pas au brut (sinon un paiement net valide est bloqué).
  // L'envoi reste brut + customerId (backend redérive le net). En XOF, net = valeur affichée.
  const netTotalXOF = Math.max(0, totalAmt - loyaltyDiscountFor(customer, tenant, totalAmt, discAmt))

  const onAdd = (p: Product) => {
    // Anti sur-vente : refuse d'ajouter au-delà du stock (le store plafonne aussi par sécurité).
    const inCart = cart.find(c => c.productId === p.id)?.quantity ?? 0
    if (p.stockQty > 0 && inCart >= p.stockQty) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
      Alert.alert(
        i('Stock maximum', 'Maximum stock', 'Stock máximo', 'Stock massimo'),
        i(
          `Il ne reste que ${p.stockQty} en stock pour « ${p.name} ».`,
          `Only ${p.stockQty} left in stock for "${p.name}".`,
          `Solo quedan ${p.stockQty} en stock de «${p.name}».`,
          `Restano solo ${p.stockQty} in stock per "${p.name}".`,
        ),
      )
      return
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    addItem(p)
  }

  // Alerte « vente en file » — réseau hors-ligne OU lent/5xx persistant. La vente n'est
  // PAS perdue : la resync l'enverra avec la même clé d'idempotence (dédup backend).
  const showQueuedAlert = () => {
    Alert.alert(
      i('✅ Vente enregistrée', '✅ Sale recorded', '✅ Venta registrada', '✅ Vendita registrata'),
      i(
        'Synchro en attente — elle partira automatiquement au retour du réseau.',
        'Sync pending — it will upload automatically when the network is back.',
        'Sincronización pendiente — se enviará automáticamente al volver la red.',
        'Sincronizzazione in attesa — partirà automaticamente al ritorno della rete.',
      ),
    )
  }

  // ── Création de la vente (résiliente : retry → file offline ; cf. submitSaleResilient) ──
  const saleMutation = useMutation({
    mutationFn: (payload: SalePayload) => submitSaleResilient(payload),
    onSuccess: async (result: SaleSubmitResult, variables: SalePayload) => {
      // Capture la vente avant de vider le panier (pour le ticket WhatsApp).
      // ⚠️ Le mode réel (et le split mixte) viennent du PAYLOAD envoyé, pas du store
      // (le mode 'mixed' est choisi dans la modale, jamais écrit dans posStore).
      const saleItems = [...cart]
      const saleTotal = totalAmt
      const saleMode  = variables.paymentMode
      const saleSplit = variables.paymentMode === 'mixed'
        ? { cashAmount: variables.cashAmount ?? 0, mobileMoneyAmount: variables.mobileMoneyAmount ?? 0, cardAmount: variables.cardAmount ?? 0 }
        : undefined
      const saleCustomer = customer
      recordSale(totalAmt)
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      clearCart()
      setShowConfirm(false)
      setShowCart(false)
      setPendingOverride(null)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})

      // Réseau lent/5xx persistant → vente mise en file (pas perdue) : UX honnête, pas de reçu.
      if (result.status === 'queued') {
        if (saleCustomer) qc.invalidateQueries({ queryKey: ['customers'] })
        // Différé : laisser les modales se fermer avant l'alerte (sinon avalée).
        setTimeout(showQueuedAlert, ALERT_AFTER_MODAL_MS)
        return
      }
      const data = result.sale
      // Fidélité : le créditage est SERVEUR. On relit le solde canonique du client
      // (GET /api/customers/:id/loyalty) et on affiche le DELTA (après − avant) — on ne
      // recalcule JAMAIS la règle côté mobile. Réseau KO → on n'affiche pas de ligne fidélité.
      let linked = ''
      if (saleCustomer) {
        qc.invalidateQueries({ queryKey: ['customers'] })
        qc.invalidateQueries({ queryKey: ['loyalty', saleCustomer.id] })
        try {
          const before = saleCustomer.loyaltyPoints ?? 0
          const after = await customersApi.loyalty(saleCustomer.id)
          const delta = (after.points ?? before) - before
          linked = delta > 0
            ? `⭐ +${delta} ${i('points fidélité', 'loyalty points', 'puntos de fidelidad', 'punti fedeltà')} — ${saleCustomer.name} (${after.points} ${i('pts', 'pts', 'pts', 'pti')})\n\n`
            : `${i('Client', 'Customer', 'Cliente', 'Cliente')} : ${saleCustomer.name} (${after.points} ${i('pts', 'pts', 'pts', 'pti')})\n\n`
        } catch { /* solde indisponible (réseau) → pas de ligne fidélité */ }
      }
      // Données de reçu figées (panier déjà vidé) — partagées impression + WhatsApp.
      const ticket = {
        items: saleItems, total: saleTotal, paymentMode: saleMode, split: saleSplit,
        saleId: data?.id ?? Date.now().toString(),
        shopName: tenant?.name ?? 'HabaShop',
        currency, lang, fmt, vatRate: tenant?.vatRate,
      }
      // Différé : laisser le panier + la confirmation se fermer avant l'alerte native
      // (sinon l'Alert — et le dialog d'impression — sont avalés pendant le teardown).
      // Boutons de l'alerte succès. La carte fidélité n'est proposée que si la vente est
      // liée à un client ET le programme fidélité est activé pour le tenant.
      const alertButtons: Parameters<typeof Alert.alert>[2] = [
        { text: i('Non merci', 'No thanks', 'No gracias', 'No grazie'), style: 'cancel' },
        {
          text: '🖨️ ' + i('Imprimer', 'Print', 'Imprimir', 'Stampa'),
          // Annulation de l'impression = normal → pas d'alerte (le service log en interne).
          onPress: () => { printReceipt(ticket) },
        },
        {
          text: '💬 WhatsApp',
          onPress: async () => {
            const ok = await sendWhatsAppTicket(ticket)
            if (!ok) {
              Alert.alert(i('WhatsApp indisponible', 'WhatsApp unavailable', 'WhatsApp no disponible', 'WhatsApp non disponibile'), '')
            }
          },
        },
      ]
      if (saleCustomer && tenant?.enableLoyalty) {
        alertButtons.push({
          text: '🎴 ' + i('Voir la carte fidélité', 'View loyalty card', 'Ver tarjeta fidelidad', 'Vedi carta fedeltà'),
          onPress: () => setLoyaltyCardId(saleCustomer.id),
        })
      }
      // Différé : laisser le panier + la confirmation se fermer avant l'alerte native
      // (sinon l'Alert — et le dialog d'impression — sont avalés pendant le teardown).
      setTimeout(() => {
        Alert.alert(
          i('✅ Vente enregistrée', '✅ Sale recorded', '✅ Venta registrada', '✅ Vendita registrata'),
          linked + i('Envoyer le reçu par WhatsApp ?', 'Send receipt via WhatsApp?', '¿Enviar recibo por WhatsApp?', 'Inviare ricevuta via WhatsApp?'),
          alertButtons,
        )
      }, ALERT_AFTER_MODAL_MS)
    },
    onError: (e: unknown) => {
      Alert.alert(
        i('Erreur', 'Error', 'Error', 'Errore'),
        apiErrorMessage(e) ?? i('Échec de l\'enregistrement', 'Failed to record sale', 'Error al registrar', 'Registrazione fallita'),
      )
    },
  })

  // ── Validation de la vente : online → API, offline → file d'attente ──
  // `override` fourni uniquement en paiement MIXTE (paymentMode='mixed' + ventilation XOF).
  const confirmSale = async (override?: { paymentMode: string } & MixedSplit) => {
    const mode = override?.paymentMode ?? paymentMode
    // Hors-ligne : seuls les paiements ESPÈCES sont autorisés. Mobile Money (Wave/Orange) et
    // carte exigent le réseau pour confirmer la transaction → on bloque proprement (le paiement
    // mixte inclut potentiellement ces modes → également refusé hors-ligne).
    if (!isOnline && mode !== 'cash') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
      Alert.alert(
        i('Espèces uniquement hors-ligne', 'Cash only offline', 'Solo efectivo sin conexión', 'Solo contanti offline'),
        i(
          'Les paiements Mobile Money et carte nécessitent une connexion. Repassez en espèces pour encaisser hors-ligne.',
          'Mobile Money and card payments require a connection. Switch to cash to check out offline.',
          'Los pagos Mobile Money y tarjeta requieren conexión. Cambie a efectivo para cobrar sin conexión.',
          'I pagamenti Mobile Money e carta richiedono una connessione. Passa ai contanti per incassare offline.',
        ),
      )
      return
    }
    // Garde espèces : interdit l'encaissement si le montant reçu est < total (mode cash
    // SIMPLE uniquement ; mixte / Wave / Orange / Carte non concernés). Filet défensif — le
    // bouton « Encaisser » est déjà désactivé côté panier dans ce cas. `cashGiven` est saisi
    // en devise d'affichage → ramené en XOF de base (comme totalAmt) avant comparaison.
    if (mode === 'cash' && convertToXOF(cashGiven, currency, rates) < netTotalXOF) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      Alert.alert(
        i('Montant insuffisant', 'Insufficient amount', 'Monto insuficiente', 'Importo insufficiente'),
        i(
          'Le montant reçu est inférieur au total à payer.',
          'The amount received is less than the total due.',
          'El monto recibido es inferior al total a pagar.',
          'L\'importo ricevuto è inferiore al totale da pagare.',
        ),
      )
      return
    }
    // Clé d'idempotence : UNE par tentative de vente, réutilisée par le retry online ET
    // la resync offline (NE PAS la régénérer → sinon doublon). Le backend dédup dessus.
    const payload: SalePayload = {
      items: cart.map(c => ({ productId: c.productId, qty: c.quantity, price: c.price })),
      total: totalAmt,
      paymentMode: mode,
      ...(discAmt > 0 ? { discount: { amount: discAmt, type: 'percent' } } : {}),
      ...(customer ? { customerId: customer.id } : {}),
      ...(override ? {
        cashAmount: override.cashAmount,
        mobileMoneyAmount: override.mobileMoneyAmount,
        cardAmount: override.cardAmount,
      } : {}),
      idempotencyKey: newIdempotencyKey(),
    }
    // Hors-ligne dur (NetInfo) → file directe, pas d'aller-retour réseau inutile.
    if (!isOnline) {
      await enqueueAction('SALE', payload)
      recordSale(totalAmt)
      clearCart()
      setShowConfirm(false)
      setShowCart(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      showQueuedAlert()
      return
    }
    // En ligne → soumission résiliente (retry même clé → bascule file si réseau lent/5xx).
    saleMutation.mutate(payload)
  }

  // ── Routeur de scan : aiguille selon le mode actif (produit vs carte client) ──
  const handleScan = (value: string) => {
    setShowScanner(false)
    if (scanMode === 'customer') handleCustomerScan(value)
    else handleProductScan(value)
  }

  // ── Scan QR carte fidélité → lie le client ──
  // Nouveau format HABA-CUST:<id> : GET /api/customers/:id direct.
  // Ancien format HABA-<id8 MAJ> : matching contre la liste chargée (cache react-query).
  const handleCustomerScan = async (raw: string) => {
    let match: Customer | null = null
    const directId = extractDirectCustomerId(raw)
    if (directId) {
      try { match = await customersApi.get(directId) } catch { match = null }
    }
    if (!match) {
      let customers = qc.getQueryData<Customer[]>(['customers'])
      if (!customers) {
        try { customers = await customersApi.list() } catch { customers = [] }
      }
      match = matchCustomerByCode(raw, customers ?? [])
    }
    if (match) {
      setCustomer(match)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      Alert.alert(
        '✅ ' + (match.name?.trim() ?? ''),
        i('Client lié à la vente', 'Customer linked to the sale', 'Cliente vinculado a la venta', 'Cliente collegato alla vendita'),
        [{ text: 'OK' }],
      )
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      Alert.alert(
        i('Carte non reconnue', 'Card not recognized', 'Tarjeta no reconocida', 'Carta non riconosciuta'),
        i(
          'Cette carte fidélité ne correspond à aucun client.',
          'This loyalty card matches no customer.',
          'Esta tarjeta de fidelidad no corresponde a ningún cliente.',
          'Questa carta fedeltà non corrisponde a nessun cliente.',
        ),
        [{ text: 'OK' }],
      )
    }
  }

  // ── Scan code-barres : ajoute le produit trouvé au panier ──
  // Le scanner (expo-camera) et la base peuvent diverger sur les zéros de
  // tête (UPC-A 12 chiffres ↔ EAN-13 13 chiffres) ou les espaces parasites.
  // → on normalise les deux côtés avant comparaison (cf. tests `barcode`).
  const handleProductScan = (barcode: string) => {
    const scanned = normalizeBarcode(barcode)
    const product = scanned
      ? products.find(
          (p) =>
            normalizeBarcode(p.barcode) === scanned ||
            normalizeBarcode(p.ean) === scanned ||
            p.id === barcode,
        )
      : undefined
    if (product) {
      addItem(product)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
      Alert.alert('✅ ' + (product.name?.trim() ?? ''), fmt(product.sellPrice ?? 0), [{ text: 'OK' }])
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      Alert.alert(
        i('Produit introuvable', 'Product not found', 'Producto no encontrado', 'Prodotto non trovato'),
        `Code: ${barcode}`,
        [{ text: 'OK' }],
      )
    }
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <ScreenHeader
        center
        backIcon="close"
        title={i('Caisse', 'Register', 'Caja', 'Cassa')}
        onBack={() => {
          // Cas froid (deeplink, app killed) : router.back() ne fait rien.
          // Fallback : navigation explicite vers le dashboard.
          if (router.canGoBack()) router.back()
          else router.replace('/(app)/(tabs)/dashboard')
        }}
        right={
          <>
            <Pressable style={s.headerBtn} onPress={() => { setScanMode('product'); setShowScanner(true) }} hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={i('Scanner un code-barres', 'Scan a barcode', 'Escanear código', 'Scansiona codice')}>
              <Ionicons name="scan-outline" size={22} color={C.text} />
            </Pressable>
            <Pressable style={s.headerBtn} onPress={() => setShowCart(true)} hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${i('Panier', 'Cart', 'Carrito', 'Carrello')}, ${totalQty}`}>
              <Ionicons name="cart-outline" size={22} color={C.text} />
              {totalQty > 0 && (
                <View style={s.cartBadge}><Text style={s.cartBadgeTxt}>{totalQty}</Text></View>
              )}
            </Pressable>
          </>
        }
      />

      {/* Bandeau hors-ligne (ventes mises en file, espèces uniquement). */}
      <OfflineBanner context="pos" />

      {/* ── Filtres catégories ── */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.cats}
        >
          {[{ key: 'all', label: i('Tout', 'All', 'Todo', 'Tutto') },
            ...categories.map(c => ({ key: c, label: c }))].map(c => (
            <Chip
              key={c.key}
              label={c.label}
              selected={activeCat === c.key}
              onPress={() => setActiveCat(c.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* ── Grille produits ── */}
      <POSProductGrid
        filtered={filtered}
        cart={cart}
        onAdd={onAdd}
        fmt={fmt}
        fmtParts={fmtParts}
        i={i}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />

      {/* ── Barre totale ── */}
      {cart.length > 0 && (
        <View style={[s.totalBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.totalBarLabel}>{totalQty} {plural(totalQty, i('article', 'item', 'artículo', 'articolo'), i('articles', 'items', 'artículos', 'articoli'))}</Text>
            <Text style={s.totalBarAmt}>{fmt(totalAmt)}</Text>
          </View>
          <AccessibleButton
            label={`${i('Encaisser', 'Checkout', 'Cobrar', 'Incassare')} →`}
            onPress={() => setShowCart(true)}
            hint={`${i('Encaisser', 'Checkout', 'Cobrar', 'Incassare')} ${fmt(totalAmt)}`}
          />
        </View>
      )}

      {/* Overlays montés À LA DEMANDE (pas tous montés visible={false} en même temps).
          Crash Fabric/New Arch « addViewAt: failed to insert view » : empiler plusieurs
          <Modal> au montage de l'écran fait planter la réconciliation de vues. On ne monte
          chaque modal que lorsqu'il est ouvert → aucun Modal présent à l'ouverture de la caisse. */}
      {showCart && (
        <POSCart
          visible
          onClose={() => setShowCart(false)}
          onCheckout={(override) => { setPendingOverride(override ?? null); setShowConfirm(true) }}
          cart={cart}
          paymentMode={paymentMode}
          cashGiven={cashGiven}
          subtotal={subAmt}
          total={totalAmt}
          onUpdateQty={updateQty}
          onRemove={removeItem}
          onSetPaymentMode={setPaymentMode}
          onSetCashGiven={setCashGiven}
          onClearCart={clearCart}
          customer={customer}
          onOpenCustomer={() => setShowCustomerPicker(true)}
          onClearCustomer={() => setCustomer(null)}
          discount={discount}
          onSetDiscount={setDiscount}
          vatRate={tenant?.vatRate}
          fmt={fmt}
          i={i}
        />
      )}

      {showCustomerPicker && (
        <CustomerPicker
          visible
          selectedId={customer?.id ?? null}
          onSelect={(c) => { setCustomer(c); setShowCustomerPicker(false) }}
          onClose={() => setShowCustomerPicker(false)}
          // Scanner la carte fidélité : ferme le sélecteur, ouvre le scanner en mode client
          // (panier reste monté dessous → 2 modales max, cf. pattern Cart+Confirm existant).
          onScanCard={() => { setShowCustomerPicker(false); setScanMode('customer'); setShowScanner(true) }}
        />
      )}

      {showConfirm && (
        <POSConfirmModal
          visible
          onClose={() => setShowConfirm(false)}
          onConfirm={() => confirmSale(pendingOverride ?? undefined)}
          isSelling={saleMutation.isPending}
          cart={cart}
          total={totalAmt}
          paymentMode={pendingOverride?.paymentMode ?? paymentMode}
          vatRate={tenant?.vatRate}
          fmt={fmt}
          i={i}
        />
      )}

      {/* Idem scanner : monté à la demande (le hook caméra ne s'initialise qu'au 1er scan). */}
      {showScanner && (
        <BarcodeScanner
          visible
          mode={scanMode}
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Carte fidélité numérique — proposée après une vente liée à un client (à la demande). */}
      {!!loyaltyCardId && (
        <LoyaltyCardDigital customerId={loyaltyCardId} onClose={() => setLoyaltyCardId(null)} />
      )}
    </View>
  )
}

// ── Styles ───────────────────────────────────────
const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  headerBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bg,
  },
  cartBadgeTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_800ExtraBold', color: C.white },

  cats: { gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },

  totalBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    backgroundColor: C.bg2, borderTopWidth: 1, borderTopColor: C.border,
  },
  totalBarLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text3 },
  totalBarAmt: { fontSize: FontSize.xl, fontFamily: 'JetBrainsMono_700Bold', color: C.accent },
})
