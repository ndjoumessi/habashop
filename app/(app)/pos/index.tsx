import { useState, useMemo } from 'react'
import {
  View, Text, TextInput, ScrollView,
  StyleSheet, Alert, Pressable,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { productsApi, salesApi } from '@/services/api'
import { usePosStore } from '@/stores/posStore'
import { useI18n, useFmt, useTheme } from '@/stores/appStore'
import {
  ThemeColors, Spacing, BorderRadius, FontSize, Shadow,
} from '@/constants/theme'
import { useAuthStore } from '@/stores/authStore'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { enqueueAction } from '@/services/offlineQueue'
import { sendWhatsAppTicket } from '@/services/whatsappTicket'
import BarcodeScanner from '@/components/pos/BarcodeScanner'
import ErrorState from '@/components/ui/ErrorState'
import POSConfirmModal from '@/components/pos/POSConfirmModal'
import POSCart from '@/components/pos/POSCart'
import POSProductGrid from '@/components/pos/POSProductGrid'

// ── Écran POS ────────────────────────────────────
export default function POSScreen() {
  const insets = useSafeAreaInsets()
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i, lang } = useI18n()
  const { fmt, currency } = useFmt()
  const { tenant } = useAuthStore()
  const { isOnline } = useNetworkStatus()
  const qc = useQueryClient()

  const cart           = usePosStore(st => st.cart)
  const addItem        = usePosStore(st => st.addItem)
  const removeItem     = usePosStore(st => st.removeItem)
  const updateQty      = usePosStore(st => st.updateQty)
  const clearCart      = usePosStore(st => st.clearCart)
  const paymentMode    = usePosStore(st => st.paymentMode)
  const setPaymentMode = usePosStore(st => st.setPaymentMode)
  const cashGiven      = usePosStore(st => st.cashGiven)
  const setCashGiven   = usePosStore(st => st.setCashGiven)
  const recordSale     = usePosStore(st => st.recordSale)
  const subtotal       = usePosStore(st => st.subtotal)
  const total          = usePosStore(st => st.total)

  const [search, setSearch]       = useState('')
  const [activeCat, setActiveCat] = useState('all')
  const [showCart, setShowCart]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showScanner, setShowScanner] = useState(false)

  const { data: products = [], isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: ['products'],
    queryFn:  () => productsApi.list(),
    staleTime: 2 * 60 * 1000,
  })

  const active = useMemo(
    () => (products ?? []).filter((p: any) => p.isActive !== false),
    [products],
  )
  const categories = useMemo(
    () => Array.from(new Set(active.map((p: any) => p.category).filter(Boolean))) as string[],
    [active],
  )
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return active.filter((p: any) =>
      (activeCat === 'all' || p.category === activeCat) &&
      (!q || p.name?.toLowerCase().includes(q) || p.barcode?.includes(q)),
    )
  }, [active, activeCat, search])

  const totalQty   = cart.reduce((n, c) => n + c.quantity, 0)
  const totalAmt   = total()
  const subAmt     = subtotal()
  const discAmt    = subAmt - totalAmt

  const onAdd = (p: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    addItem(p)
  }

  // ── Création de la vente ──
  const saleMutation = useMutation({
    mutationFn: () => salesApi.create({
      items: cart.map(c => ({ productId: c.productId, qty: c.quantity, price: c.price })),
      total: totalAmt,
      paymentMode,
      ...(discAmt > 0 ? { discount: { amount: discAmt, type: 'percent' } } : {}),
    }),
    onSuccess: (data: any) => {
      // Capture la vente avant de vider le panier (pour le ticket WhatsApp)
      const saleItems = [...cart]
      const saleTotal = totalAmt
      const saleMode  = paymentMode
      recordSale(totalAmt)
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      clearCart()
      setShowConfirm(false)
      setShowCart(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      Alert.alert(
        i('✅ Vente enregistrée', '✅ Sale recorded', '✅ Venta registrada', '✅ Vendita registrata'),
        i('Envoyer le reçu par WhatsApp ?', 'Send receipt via WhatsApp?', '¿Enviar recibo por WhatsApp?', 'Inviare ricevuta via WhatsApp?'),
        [
          { text: i('Non merci', 'No thanks', 'No gracias', 'No grazie'), style: 'cancel' },
          {
            text: '💬 WhatsApp',
            onPress: async () => {
              const ok = await sendWhatsAppTicket({
                items: saleItems, total: saleTotal, paymentMode: saleMode,
                saleId: data?.id ?? Date.now().toString(),
                shopName: tenant?.name ?? 'HabaShop',
                currency, lang, fmt,
              })
              if (!ok) {
                Alert.alert(i('WhatsApp indisponible', 'WhatsApp unavailable', 'WhatsApp no disponible', 'WhatsApp non disponibile'), '')
              }
            },
          },
        ],
      )
    },
    onError: (e: any) => {
      Alert.alert(
        i('Erreur', 'Error', 'Error', 'Errore'),
        e?.response?.data?.error ?? i('Échec de l\'enregistrement', 'Failed to record sale', 'Error al registrar', 'Registrazione fallita'),
      )
    },
  })

  // ── Validation de la vente : online → API, offline → file d'attente ──
  const confirmSale = async () => {
    if (!isOnline) {
      await enqueueAction('SALE', {
        items: cart.map(c => ({ productId: c.productId, qty: c.quantity, price: c.price })),
        total: totalAmt,
        paymentMode,
        ...(discAmt > 0 ? { discount: { amount: discAmt, type: 'percent' } } : {}),
      })
      recordSale(totalAmt)
      clearCart()
      setShowConfirm(false)
      setShowCart(false)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      Alert.alert(
        i('✅ Vente sauvegardée', '✅ Sale saved', '✅ Venta guardada', '✅ Vendita salvata'),
        i(
          'Synchronisée automatiquement au retour du réseau.',
          'Will sync automatically when back online.',
          'Se sincronizará automáticamente al volver en línea.',
          'Si sincronizzerà automaticamente al ritorno della rete.',
        ),
      )
      return
    }
    saleMutation.mutate()
  }

  // ── Scan code-barres : ajoute le produit trouvé au panier ──
  const handleBarcodeScan = (barcode: string) => {
    setShowScanner(false)
    const product = (products as any[]).find(
      (p: any) => p.barcode === barcode || p.ean === barcode || p.id === barcode,
    )
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
      <View style={s.header}>
        <Pressable
          style={s.headerBtn}
          onPress={() => {
            // Cas froid (deeplink, app killed) : router.back() ne fait rien.
            // Fallback : navigation explicite vers le dashboard.
            if (router.canGoBack()) router.back()
            else router.replace('/(app)/(tabs)/dashboard')
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={i('Fermer la caisse', 'Close register', 'Cerrar caja', 'Chiudi cassa')}>
          <Ionicons name="close" size={22} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>{i('Caisse', 'Register', 'Caja', 'Cassa')}</Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Pressable style={s.headerBtn} onPress={() => setShowScanner(true)} hitSlop={8}
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
        </View>
      </View>

      {/* ── Recherche ── */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={C.text3} />
        <TextInput
          style={s.searchInput}
          placeholder={i('Rechercher un produit…', 'Search a product…', 'Buscar un producto…', 'Cerca un prodotto…')}
          placeholderTextColor={C.text4}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          accessibilityLabel={i('Rechercher un produit', 'Search a product', 'Buscar un producto', 'Cerca un prodotto')}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={i('Effacer la recherche', 'Clear search', 'Borrar búsqueda', 'Cancella ricerca')}>
            <Ionicons name="close-circle" size={18} color={C.text3} />
          </Pressable>
        )}
      </View>

      {/* ── Filtres catégories ── */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.cats}
        >
          {[{ key: 'all', label: i('Tout', 'All', 'Todo', 'Tutto') },
            ...categories.map(c => ({ key: c, label: c }))].map(c => {
            const on = activeCat === c.key
            return (
              <Pressable
                key={c.key}
                onPress={() => setActiveCat(c.key)}
                style={[s.chip, on && s.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={c.label}
              >
                <Text style={[s.chipTxt, on && s.chipTxtOn]} numberOfLines={1}>{c.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {/* ── Grille produits ── */}
      <POSProductGrid
        filtered={filtered}
        cart={cart}
        onAdd={onAdd}
        fmt={fmt}
        i={i}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />

      {/* ── Barre totale ── */}
      {cart.length > 0 && (
        <View style={[s.totalBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.totalBarLabel}>{totalQty} {i('articles', 'items', 'artículos', 'articoli')}</Text>
            <Text style={s.totalBarAmt}>{fmt(totalAmt)}</Text>
          </View>
          <Pressable style={s.checkoutBtn} onPress={() => setShowCart(true)}
            accessibilityRole="button"
            accessibilityLabel={`${i('Encaisser', 'Checkout', 'Cobrar', 'Incassare')} ${fmt(totalAmt)}`}>
            <Text style={s.checkoutTxt}>{i('Encaisser', 'Checkout', 'Cobrar', 'Incassare')} →</Text>
          </Pressable>
        </View>
      )}

      <POSCart
        visible={showCart}
        onClose={() => setShowCart(false)}
        onCheckout={() => setShowConfirm(true)}
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
        fmt={fmt}
        i={i}
      />

      <POSConfirmModal
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmSale}
        isSelling={saleMutation.isPending}
        cart={cart}
        total={totalAmt}
        paymentMode={paymentMode}
        fmt={fmt}
        i={i}
      />

      <BarcodeScanner
        visible={showScanner}
        onScan={handleBarcodeScan}
        onClose={() => setShowScanner(false)}
      />
    </View>
  )
}

// ── Styles ───────────────────────────────────────
const makeStyles = (C: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  cartBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bg,
  },
  cartBadgeTxt: { fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: C.white },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md, height: 44,
    backgroundColor: C.bg3, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text },

  cats: { gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: BorderRadius.full,
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border, maxWidth: 160,
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  chipTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
  chipTxtOn: { color: C.white },

  totalBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    backgroundColor: C.bg2, borderTopWidth: 1, borderTopColor: C.border,
  },
  totalBarLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text3 },
  totalBarAmt: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', color: C.text },
  checkoutBtn: {
    backgroundColor: C.primary, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl, height: 50, alignItems: 'center', justifyContent: 'center',
    ...Shadow.colored(C.primary),
  },
  checkoutTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.white },
})
