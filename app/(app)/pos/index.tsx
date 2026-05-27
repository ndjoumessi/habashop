import { useState, useMemo } from 'react'
import {
  View, Text, TextInput, FlatList, ScrollView,
  TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, Alert, Pressable,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { productsApi, salesApi } from '@/services/api'
import { usePosStore, type CartItem } from '@/stores/posStore'
import { useI18n, useFmt } from '@/stores/appStore'
import {
  Colors, Spacing, BorderRadius, FontSize, Shadow,
} from '@/constants/theme'
import { useAuthStore } from '@/stores/authStore'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { enqueueAction } from '@/services/offlineQueue'
import { sendWhatsAppTicket } from '@/services/whatsappTicket'
import BarcodeScanner from '@/components/pos/BarcodeScanner'
import ErrorState from '@/components/ui/ErrorState'

const PAY_MODES = [
  { id: 'cash',   icon: '💵', fr: 'Espèces',  en: 'Cash',   es: 'Efectivo', it: 'Contanti' },
  { id: 'wave',   icon: '🌊', fr: 'Wave',     en: 'Wave',   es: 'Wave',     it: 'Wave'     },
  { id: 'orange', icon: '🟠', fr: 'Orange',   en: 'Orange', es: 'Orange',   it: 'Orange'   },
  { id: 'card',   icon: '💳', fr: 'Carte',    en: 'Card',   es: 'Tarjeta',  it: 'Carta'    },
] as const

// ── Carte produit ────────────────────────────────
function ProductCard({
  product, qtyInCart, fmt, onPress,
}: {
  product: any; qtyInCart: number
  fmt: (n: number) => string
  onPress: () => void
}) {
  const out = (product.stockQty ?? 0) <= 0
  return (
    <TouchableOpacity
      style={[s.prodCard, out && s.prodCardOut]}
      activeOpacity={0.7}
      disabled={out}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: out }}
      accessibilityLabel={`${product.name?.trim() ?? ''}, ${fmt(product.sellPrice ?? 0)}`}
    >
      {qtyInCart > 0 && (
        <View style={s.prodBadge}>
          <Text style={s.prodBadgeTxt}>{qtyInCart}</Text>
        </View>
      )}
      {out && (
        <View style={s.prodOutBadge}>
          <Ionicons name="close" size={11} color={Colors.white} />
        </View>
      )}
      <Text style={s.prodEmoji}>{product.emoji ?? '📦'}</Text>
      <Text style={s.prodName} numberOfLines={2}>{product.name?.trim()}</Text>
      <Text style={s.prodPrice}>{fmt(product.sellPrice ?? 0)}</Text>
    </TouchableOpacity>
  )
}

// ── Ligne panier ─────────────────────────────────
function CartRow({
  item, fmt, i, onInc, onDec, onDel,
}: {
  item: CartItem; fmt: (n: number) => string
  i: (fr: string, en: string, es: string, it: string) => string
  onInc: () => void; onDec: () => void; onDel: () => void
}) {
  return (
    <View style={s.cartRow}>
      <Text style={{ fontSize: 26 }}>{item.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.cartName} numberOfLines={1}>{item.name?.trim()}</Text>
        <Text style={s.cartLine}>{fmt(item.price)} × {item.quantity} = {fmt(item.price * item.quantity)}</Text>
      </View>
      <View style={s.qtyBox}>
        <Pressable style={s.qtyBtn} onPress={onDec} hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${i('Diminuer', 'Decrease', 'Disminuir', 'Diminuisci')} ${item.name?.trim()}`}>
          <Ionicons name="remove" size={16} color={Colors.text} />
        </Pressable>
        <Text style={s.qtyVal}>{item.quantity}</Text>
        <Pressable style={s.qtyBtn} onPress={onInc} hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${i('Augmenter', 'Increase', 'Aumentar', 'Aumenta')} ${item.name?.trim()}`}>
          <Ionicons name="add" size={16} color={Colors.text} />
        </Pressable>
      </View>
      <Pressable onPress={onDel} hitSlop={8} style={s.delBtn}
        accessibilityRole="button"
        accessibilityLabel={`${i('Supprimer', 'Remove', 'Eliminar', 'Rimuovi')} ${item.name?.trim()}`}>
        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
      </Pressable>
    </View>
  )
}

// ── Écran POS ────────────────────────────────────
export default function POSScreen() {
  const insets = useSafeAreaInsets()
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
  const discount       = usePosStore(st => st.discount)
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
  const change     = cashGiven - totalAmt

  const qtyOf = (id: string) => cart.find(c => c.productId === id)?.quantity ?? 0

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
        <Pressable style={s.headerBtn} onPress={() => router.back()} hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={i('Fermer la caisse', 'Close register', 'Cerrar caja', 'Chiudi cassa')}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>{i('Caisse', 'Register', 'Caja', 'Cassa')}</Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <Pressable style={s.headerBtn} onPress={() => setShowScanner(true)} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={i('Scanner un code-barres', 'Scan a barcode', 'Escanear código', 'Scansiona codice')}>
            <Ionicons name="scan-outline" size={22} color={Colors.text} />
          </Pressable>
          <Pressable style={s.headerBtn} onPress={() => setShowCart(true)} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${i('Panier', 'Cart', 'Carrito', 'Carrello')}, ${totalQty}`}>
            <Ionicons name="cart-outline" size={22} color={Colors.text} />
            {totalQty > 0 && (
              <View style={s.cartBadge}><Text style={s.cartBadgeTxt}>{totalQty}</Text></View>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Recherche ── */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.text3} />
        <TextInput
          style={s.searchInput}
          placeholder={i('Rechercher un produit…', 'Search a product…', 'Buscar un producto…', 'Cerca un prodotto…')}
          placeholderTextColor={Colors.text4}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          accessibilityLabel={i('Rechercher un produit', 'Search a product', 'Buscar un producto', 'Cerca un prodotto')}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={i('Effacer la recherche', 'Clear search', 'Borrar búsqueda', 'Cancella ricerca')}>
            <Ionicons name="close-circle" size={18} color={Colors.text3} />
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
      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p: any) => p.id}
          numColumns={3}
          columnWrapperStyle={{ gap: Spacing.sm, paddingHorizontal: Spacing.lg }}
          contentContainerStyle={{ gap: Spacing.sm, paddingTop: Spacing.sm, paddingBottom: cart.length > 0 ? 110 : Spacing.xl }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyTxt}>{i('Aucun produit', 'No products', 'Sin productos', 'Nessun prodotto')}</Text>
            </View>
          }
          renderItem={({ item }: { item: any }) => (
            <ProductCard
              product={item}
              qtyInCart={qtyOf(item.id)}
              fmt={fmt}
              onPress={() => onAdd(item)}
            />
          )}
        />
      )}

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

      {/* ── Modal Panier ── */}
      <Modal visible={showCart} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCart(false)}>
        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{i('Panier', 'Cart', 'Carrito', 'Carrello')} ({totalQty})</Text>
            <Pressable onPress={() => setShowCart(false)} hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.sm }}>
            {cart.length === 0 ? (
              <Text style={s.emptyTxt}>{i('Panier vide', 'Empty cart', 'Carrito vacío', 'Carrello vuoto')}</Text>
            ) : cart.map(item => (
              <CartRow
                key={item.productId}
                item={item}
                fmt={fmt}
                i={i}
                onInc={() => updateQty(item.productId, item.quantity + 1)}
                onDec={() => updateQty(item.productId, item.quantity - 1)}
                onDel={() => removeItem(item.productId)}
              />
            ))}
          </ScrollView>

          {cart.length > 0 && (
            <View style={[s.sheetFoot, { paddingBottom: insets.bottom + Spacing.md }]}>
              {/* Récap montants */}
              <View style={s.recapRow}>
                <Text style={s.recapLabel}>{i('Sous-total', 'Subtotal', 'Subtotal', 'Subtotale')}</Text>
                <Text style={s.recapVal}>{fmt(subAmt)}</Text>
              </View>
              {discAmt > 0 && (
                <View style={s.recapRow}>
                  <Text style={s.recapLabel}>{i('Remise', 'Discount', 'Descuento', 'Sconto')}</Text>
                  <Text style={[s.recapVal, { color: Colors.accent2 }]}>− {fmt(discAmt)}</Text>
                </View>
              )}
              <View style={[s.recapRow, s.recapTotal]}>
                <Text style={s.recapTotalLabel}>Total</Text>
                <Text style={s.recapTotalVal}>{fmt(totalAmt)}</Text>
              </View>

              {/* Modes de paiement */}
              <View style={s.payGrid}>
                {PAY_MODES.map(m => {
                  const on = paymentMode === m.id
                  return (
                    <Pressable
                      key={m.id}
                      style={[s.payChip, on && s.payChipOn]}
                      onPress={() => setPaymentMode(m.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={i(m.fr, m.en, m.es, m.it)}
                    >
                      <Text style={{ fontSize: 18 }}>{m.icon}</Text>
                      <Text style={[s.payTxt, on && s.payTxtOn]}>{i(m.fr, m.en, m.es, m.it)}</Text>
                    </Pressable>
                  )
                })}
              </View>

              {/* Montant donné (espèces) */}
              {paymentMode === 'cash' && (
                <View style={s.cashWrap}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recapLabel}>{i('Montant donné', 'Amount given', 'Monto entregado', 'Importo dato')}</Text>
                    <TextInput
                      style={s.cashInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={Colors.text4}
                      value={cashGiven ? String(cashGiven) : ''}
                      onChangeText={t => setCashGiven(Number(t.replace(/[^0-9.]/g, '')) || 0)}
                      accessibilityLabel={i('Montant donné', 'Amount given', 'Monto entregado', 'Importo dato')}
                    />
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.recapLabel}>{i('Monnaie', 'Change', 'Cambio', 'Resto')}</Text>
                    <Text style={[s.changeVal, { color: change >= 0 ? Colors.accent2 : Colors.danger }]}>
                      {fmt(Math.max(0, change))}
                    </Text>
                  </View>
                </View>
              )}

              <Pressable
                style={s.payBtn}
                onPress={() => setShowConfirm(true)}
                accessibilityRole="button"
                accessibilityLabel={`${i('Encaisser', 'Checkout', 'Cobrar', 'Incassare')} ${fmt(totalAmt)}`}
              >
                <Text style={s.payBtnTxt}>{i('Encaisser', 'Checkout', 'Cobrar', 'Incassare')} {fmt(totalAmt)}</Text>
              </Pressable>
              <Pressable style={s.clearBtn} onPress={() => clearCart()}
                accessibilityRole="button"
                accessibilityLabel={i('Vider le panier', 'Clear cart', 'Vaciar carrito', 'Svuota carrello')}>
                <Text style={s.clearTxt}>{i('Vider le panier', 'Clear cart', 'Vaciar carrito', 'Svuota carrello')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Modal Confirmation ── */}
      <Modal visible={showConfirm} transparent animationType="fade" onRequestClose={() => setShowConfirm(false)}>
        <View style={s.confirmBackdrop}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>{i('Confirmer la vente', 'Confirm sale', 'Confirmar venta', 'Conferma vendita')}</Text>
            <View style={s.confirmRow}>
              <Text style={s.recapLabel}>{i('Articles', 'Items', 'Artículos', 'Articoli')}</Text>
              <Text style={s.recapVal}>{totalQty}</Text>
            </View>
            <View style={s.confirmRow}>
              <Text style={s.recapLabel}>{i('Paiement', 'Payment', 'Pago', 'Pagamento')}</Text>
              <Text style={s.recapVal}>
                {(() => { const m = PAY_MODES.find(x => x.id === paymentMode)!; return `${m.icon} ${i(m.fr, m.en, m.es, m.it)}` })()}
              </Text>
            </View>
            <View style={[s.confirmRow, s.recapTotal]}>
              <Text style={s.recapTotalLabel}>Total</Text>
              <Text style={s.recapTotalVal}>{fmt(totalAmt)}</Text>
            </View>

            <View style={s.confirmActions}>
              <Pressable
                style={[s.confirmBtn, s.confirmCancel]}
                disabled={saleMutation.isPending}
                onPress={() => setShowConfirm(false)}
                accessibilityRole="button"
                accessibilityLabel={i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
              >
                <Text style={s.confirmCancelTxt}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</Text>
              </Pressable>
              <Pressable
                style={[s.confirmBtn, s.confirmOk, saleMutation.isPending && { opacity: 0.6 }]}
                disabled={saleMutation.isPending}
                onPress={confirmSale}
                accessibilityRole="button"
                accessibilityState={{ disabled: saleMutation.isPending, busy: saleMutation.isPending }}
                accessibilityLabel={i('Valider la vente', 'Confirm sale', 'Validar venta', 'Conferma vendita')}
              >
                {saleMutation.isPending
                  ? <ActivityIndicator color={Colors.white} size="small" />
                  : <Text style={s.confirmOkTxt}>{i('Valider', 'Confirm', 'Validar', 'Conferma')}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <BarcodeScanner
        visible={showScanner}
        onScan={handleBarcodeScan}
        onClose={() => setShowScanner(false)}
      />
    </View>
  )
}

// ── Styles ───────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  errTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.danger, textAlign: 'center' },
  emptyTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.text3, textAlign: 'center', paddingVertical: Spacing.xxxl },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: BorderRadius.md,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: Colors.text },
  cartBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: 9, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bg,
  },
  cartBadgeTxt: { fontSize: 10, fontFamily: 'Outfit_800ExtraBold', color: Colors.white },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md, height: 44,
    backgroundColor: Colors.bg3, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: Colors.text },

  cats: { gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: BorderRadius.full,
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, maxWidth: 160,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: Colors.text2 },
  chipTxtOn: { color: Colors.white },

  prodCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm,
    alignItems: 'center', gap: 4, minHeight: 110, justifyContent: 'center',
    position: 'relative', ...Shadow.sm,
  },
  prodCardOut: { opacity: 0.45 },
  prodEmoji: { fontSize: 30 },
  prodName: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: Colors.text, textAlign: 'center' },
  prodPrice: { fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', color: Colors.accent },
  prodBadge: {
    position: 'absolute', top: 5, right: 5, minWidth: 20, height: 20, paddingHorizontal: 5,
    borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  prodBadgeTxt: { fontSize: 11, fontFamily: 'Outfit_800ExtraBold', color: Colors.white },
  prodOutBadge: {
    position: 'absolute', top: 5, left: 5, width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },

  totalBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    backgroundColor: Colors.bg2, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  totalBarLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: Colors.text3 },
  totalBarAmt: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', color: Colors.text },
  checkoutBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl, height: 50, alignItems: 'center', justifyContent: 'center',
    ...Shadow.colored(Colors.primary),
  },
  checkoutTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: Colors.white },

  // Sheet panier
  sheet: { flex: 1, backgroundColor: Colors.bg },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: Colors.text },
  sheetFoot: {
    padding: Spacing.lg, gap: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border, backgroundColor: Colors.bg2,
  },
  cartRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.card, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  cartName: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: Colors.text },
  cartLine: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: Colors.text3, marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.bg4,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyVal: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: Colors.text, minWidth: 18, textAlign: 'center' },
  delBtn: { padding: 4 },

  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recapLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.text3 },
  recapVal: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text },
  recapTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: 2 },
  recapTotalLabel: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: Colors.text },
  recapTotalVal: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', color: Colors.primary3 },

  payGrid: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  payChip: {
    flex: 1, alignItems: 'center', gap: 3, paddingVertical: Spacing.sm,
    backgroundColor: Colors.bg3, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
  },
  payChipOn: { backgroundColor: 'rgba(108,71,255,0.15)', borderColor: Colors.primary },
  payTxt: { fontSize: 9, fontFamily: 'Outfit_600SemiBold', color: Colors.text3 },
  payTxtOn: { color: Colors.primary3 },

  cashWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md, marginTop: Spacing.xs },
  cashInput: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 44, marginTop: 4,
    fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', color: Colors.text,
  },
  changeVal: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', marginTop: 4 },

  payBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, ...Shadow.colored(Colors.primary),
  },
  payBtnTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: Colors.white },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  clearTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.danger },

  // Confirmation
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  confirmCard: {
    width: '100%', maxWidth: 360, backgroundColor: Colors.card, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.xl, gap: Spacing.sm, ...Shadow.lg,
  },
  confirmTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: Colors.text, marginBottom: Spacing.xs },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  confirmBtn: { flex: 1, height: 48, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  confirmCancel: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  confirmCancelTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_700Bold', color: Colors.text2 },
  confirmOk: { backgroundColor: Colors.accent2 },
  confirmOkTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: Colors.white },
})
