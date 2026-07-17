import { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TextInput, TouchableOpacity, StatusBar, Alert, ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { productsApi, apiErrorMessage } from '@/services/api'
import type { SalePayload } from '@/types'
import { submitSaleResilient, type SaleSubmitResult } from '@/services/saleSubmit'
import { newIdempotencyKey } from '@/lib/idempotency'
import type { Product } from '@/types'
import { usePosStore, vatBreakdown } from '@/stores/posStore'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useAuthStore } from '@/stores/authStore'
import { useI18n, useFmt, useAppStore } from '@/stores/appStore'
import CustomerPicker from '@/components/pos/CustomerPicker'
import ErrorState from '@/components/ui/ErrorState'
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme'

// Boundary localisé du mode kiosque : un crash affiche un fallback (sortie possible)
// plutôt qu'un écran figé sur un poste caissier non supervisé.
export { default as ErrorBoundary } from '@/components/ui/RouteErrorFallback'

// ── Mode kiosque : POS plein écran simplifié pour un poste caissier fixe ──
// Affichage volontairement sombre/figé (pas de thème dynamique) — un kiosque
// reste sur un seul rendu. Sortie protégée par code PIN.
const EXIT_PIN = '1234'

export default function KioskScreen() {
  const qc       = useQueryClient()
  const { i }    = useI18n()
  const { fmt }  = useFmt()
  const pos      = usePosStore()
  const { tenant } = useAuthStore()
  const { setKioskMode } = useAppStore()
  const { isOnline } = useNetworkStatus()

  const [search, setSearch]             = useState('')
  const [pin, setPin]                   = useState('')
  const [showPinModal, setShowPinModal] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [tapCount, setTapCount]         = useState(0)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    data: products = [],
    isLoading: productsLoading,
    isError:   productsError,
    refetch:   refetchProducts,
  } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn:  () => productsApi.list(),
    staleTime: 2 * 60 * 1000,
  })

  const filtered = products.filter(p =>
    p.isActive !== false &&
    (!search || p.name?.toLowerCase().includes(search.toLowerCase())),
  )

  const { mutate: createSale, isPending } = useMutation({
    // Soumission résiliente (retry même clé → file offline si réseau lent/5xx) — la vente
    // d'un caissier en mode kiosque (non supervisé) ne doit JAMAIS être perdue.
    mutationFn: (payload: SalePayload) => submitSaleResilient(payload),
    onSuccess: (result: SaleSubmitResult) => {
      const saleTotal = pos.total() // capturer AVANT de vider le panier
      pos.recordSale(saleTotal)
      pos.clearCart()
      setShowConfirm(false)
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      Alert.alert(
        i('✅ Vente enregistrée !', '✅ Sale recorded!', '✅ ¡Venta registrada!', '✅ Vendita registrata!'),
        result.status === 'queued'
          ? i(
              'Synchro en attente — elle partira automatiquement au retour du réseau.',
              'Sync pending — it will upload automatically when the network is back.',
              'Sincronización pendiente — se enviará automáticamente al volver la red.',
              'Sincronizzazione in attesa — partirà automaticamente al ritorno della rete.',
            )
          : fmt(saleTotal),
      )
    },
    onError: (err: unknown) => {
      Alert.alert(
        i('Erreur', 'Error', 'Error', 'Errore'),
        apiErrorMessage(err) ?? i("Impossible d'enregistrer la vente", 'Failed to record sale', 'Error al registrar', 'Impossibile registrare'),
      )
    },
  })

  // Validation de la vente. Hors-ligne : seuls les paiements ESPÈCES sont autorisés (mêmes
  // règles que la Caisse — Wave/Orange/carte exigent le réseau pour confirmer). La vente
  // partira via la file offline (submitSaleResilient bascule en file si réseau lent/absent).
  const handleConfirmSale = () => {
    if (!isOnline && pos.paymentMode !== 'cash') {
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
    const discAmt = pos.subtotal() - pos.total()
    createSale({
      items: pos.cart.map(item => ({ productId: item.productId, qty: item.quantity, price: item.price })),
      total: pos.total(),
      paymentMode: pos.paymentMode,
      ...(discAmt > 0 ? { discount: { amount: discAmt, type: 'percent' } } : {}),
      ...(pos.customer ? { customerId: pos.customer.id } : {}),
      idempotencyKey: newIdempotencyKey(),
    })
  }

  const handleExit = () => {
    if (pin === EXIT_PIN) {
      setKioskMode(false)
      setShowPinModal(false)
      setPin('')
      router.back() // quitte réellement l'écran kiosque (poussé via router.push)
    } else {
      Alert.alert(
        i('Code incorrect', 'Wrong PIN', 'PIN incorrecto', 'PIN errato'),
        i('Réessayez', 'Try again', 'Inténtelo de nuevo', 'Riprova'),
      )
      setPin('')
    }
  }

  // Ouvre le PIN après 5 taps rapides sur ⚙️ (fallback fiable de l'appui long).
  const handleExitTap = () => {
    if (tapTimer.current) clearTimeout(tapTimer.current)
    const next = tapCount + 1
    if (next >= 5) {
      setTapCount(0)
      setShowPinModal(true)
      return
    }
    setTapCount(next)
    tapTimer.current = setTimeout(() => setTapCount(0), 2000)
  }

  // Auto-submit dès que le PIN fait 4 chiffres (plus besoin du bouton OK).
  useEffect(() => {
    if (showPinModal && pin.length === 4) handleExit()
  }, [pin, showPinModal])

  const cartCount = pos.cart.reduce((n, c) => n + c.quantity, 0)

  return (
    <View style={s.container}>
      <StatusBar hidden />

      <View style={s.layout}>
        {/* ── Colonne gauche : produits ── */}
        <View style={s.productsCol}>
          <View style={s.searchBar}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder={i('Rechercher…', 'Search…', 'Buscar…', 'Cerca…')}
              placeholderTextColor={Colors.text3}
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity
              style={s.exitBtn}
              onPress={handleExitTap}
              onLongPress={() => { setTapCount(0); setShowPinModal(true) }}
              delayLongPress={800}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={i('Quitter le mode kiosque', 'Exit kiosk mode', 'Salir del modo kiosco', 'Esci dalla modalità kiosk')}
              accessibilityHint={i('Appui long ou 5 taps rapides', 'Long press or 5 quick taps', 'Pulsación larga o 5 toques rápidos', 'Pressione lunga o 5 tocchi rapidi')}
            >
              <Text style={s.exitBtnText}>⚙️</Text>
              {tapCount > 0 && (
                <View style={s.tapCountBadge}>
                  <Text style={s.tapCountText}>{tapCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {productsLoading ? (
            <View style={s.gridState}>
              <ActivityIndicator color={Colors.primary} size="large" />
            </View>
          ) : productsError ? (
            <ErrorState onRetry={() => refetchProducts()} />
          ) : (
          <FlatList
            removeClippedSubviews={false}
            data={filtered}
            keyExtractor={p => p.id}
            numColumns={4}
            contentContainerStyle={s.grid}
            columnWrapperStyle={{ gap: Spacing.sm }}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
            renderItem={({ item: p }) => {
              const inCart = pos.cart.find(c => c.productId === p.id)?.quantity ?? 0
              const isOut  = p.stockQty <= 0
              return (
                <TouchableOpacity
                  style={[
                    s.productCard,
                    inCart > 0 && s.productCardActive,
                    isOut && s.productCardDisabled,
                  ]}
                  onPress={() => {
                    if (isOut) return
                    pos.addItem(p)
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
                  }}
                  disabled={isOut}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name} ${fmt(p.sellPrice)}`}
                  accessibilityState={{ disabled: isOut }}
                >
                  <Text style={s.productEmoji}>{p.emoji ?? '📦'}</Text>
                  {inCart > 0 && (
                    <View style={s.cartBadge}>
                      <Text style={s.cartBadgeText}>{inCart}</Text>
                    </View>
                  )}
                  <Text style={s.productName} numberOfLines={2}>{p.name}</Text>
                  <Text style={[s.productPrice, inCart > 0 && { color: Colors.primary3 }]}>
                    {fmt(p.sellPrice)}
                  </Text>
                </TouchableOpacity>
              )
            }}
          />
          )}
        </View>

        {/* ── Colonne droite : panier permanent ── */}
        <View style={s.cartCol}>
          <Text style={s.cartTitle}>
            {i('Panier', 'Cart', 'Carrito', 'Carrello')}
            {cartCount > 0 ? ` (${cartCount})` : ''}
          </Text>

          <FlatList
            removeClippedSubviews={false}
            data={pos.cart}
            keyExtractor={item => item.productId}
            style={{ flex: 1 }}
            ListEmptyComponent={() => (
              <View style={s.cartEmpty}>
                <Text style={s.cartEmptyText}>
                  {i('Panier vide', 'Empty cart', 'Carrito vacío', 'Carrello vuoto')}
                </Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={s.cartRow}>
                <Text style={s.cartEmoji}>{item.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.cartName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.cartSubtotal}>{fmt(item.price * item.quantity)}</Text>
                </View>
                <View style={s.cartQtyRow}>
                  <TouchableOpacity
                    style={s.qtyBtn}
                    onPress={() => pos.updateQty(item.productId, item.quantity - 1)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={i('Diminuer', 'Decrease', 'Reducir', 'Riduci')}
                  >
                    <Text style={s.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={[s.qtyBtn, s.qtyBtnPlus]}
                    onPress={() => pos.updateQty(item.productId, item.quantity + 1)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={i('Augmenter', 'Increase', 'Aumentar', 'Aumenta')}
                  >
                    <Text style={[s.qtyBtnText, { color: Colors.white }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          <View style={s.cartFooter}>
            {/* Client (optionnel) — réutilise CustomerPicker + posStore.customer */}
            {pos.customer ? (
              <View style={s.custChip}>
                <Text style={{ fontSize: 14 }}>👤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.custName} numberOfLines={1}>{pos.customer.name}</Text>
                  <Text style={s.custSub} numberOfLines={1}>
                    {pos.customer.loyaltyPoints ?? 0} {i('points', 'points', 'puntos', 'punti')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => pos.setCustomer(null)} hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={i('Retirer le client', 'Remove customer', 'Quitar cliente', 'Rimuovi cliente')}>
                  <Text style={s.custRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.custBtn} onPress={() => setShowCustomerPicker(true)}
                accessibilityRole="button"
                accessibilityLabel={i('Ajouter un client', 'Add a customer', 'Añadir un cliente', 'Aggiungi un cliente')}>
                <Text style={s.custBtnTxt}>
                  + {i('Client', 'Customer', 'Cliente', 'Cliente')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Remise (%) — réutilise posStore.discount/setDiscount (total() l'applique déjà) */}
            <View style={s.discountRow}>
              <Text style={s.discountLabel}>{i('Remise', 'Discount', 'Descuento', 'Sconto')}</Text>
              <View style={s.discountInputWrap}>
                <TextInput
                  style={s.discountInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.text3}
                  value={pos.discount ? String(pos.discount) : ''}
                  onChangeText={t => pos.setDiscount(Math.max(0, Math.min(100, Number(t.replace(/[^0-9.]/g, '')) || 0)))}
                  accessibilityLabel={i('Remise en pourcentage', 'Discount percentage', 'Descuento en porcentaje', 'Sconto in percentuale')}
                />
                <Text style={s.discountPct}>%</Text>
              </View>
            </View>

            <View style={s.payRow}>
              {(['cash', 'wave', 'orange', 'card'] as const).map(mode => {
                const icons = { cash: '💵', wave: '🌊', orange: '🟠', card: '💳' }
                return (
                  <TouchableOpacity
                    key={mode}
                    style={[s.payBtn, pos.paymentMode === mode && s.payBtnActive]}
                    onPress={() => pos.setPaymentMode(mode)}
                    accessibilityRole="button"
                    accessibilityLabel={mode}
                    accessibilityState={{ selected: pos.paymentMode === mode }}
                  >
                    <Text style={{ fontSize: 18 }}>{icons[mode]}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total</Text>
              <Text style={s.totalAmount}>{fmt(pos.total())}</Text>
            </View>

            <TouchableOpacity
              style={[s.checkoutBtn, pos.cart.length === 0 && { opacity: 0.4 }]}
              onPress={() => { if (pos.cart.length > 0) setShowConfirm(true) }}
              disabled={pos.cart.length === 0}
              accessibilityRole="button"
              accessibilityLabel={i('Encaisser', 'Checkout', 'Cobrar', 'Incassa')}
            >
              <Text style={s.checkoutBtnText}>
                {i('Encaisser ✓', 'Checkout ✓', 'Cobrar ✓', 'Incassa ✓')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.clearBtn}
              onPress={() => {
                if (pos.cart.length === 0) return
                Alert.alert(
                  i('Vider le panier ?', 'Clear cart?', '¿Vaciar carrito?', 'Svuotare il carrello?'),
                  '',
                  [
                    { text: i('Annuler', 'Cancel', 'Cancelar', 'Annulla'), style: 'cancel' },
                    { text: i('Vider', 'Clear', 'Vaciar', 'Svuota'), style: 'destructive', onPress: () => pos.clearCart() },
                  ],
                )
              }}
              accessibilityRole="button"
              accessibilityLabel={i('Vider le panier', 'Clear cart', 'Vaciar carrito', 'Svuota carrello')}
            >
              <Text style={s.clearBtnText}>{i('Vider', 'Clear', 'Vaciar', 'Svuota')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Modal confirmation ── */}
      {showConfirm && (
        <View style={s.confirmOverlay}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>
              {i('Confirmer ?', 'Confirm?', '¿Confirmar?', 'Confermare?')}
            </Text>

            {/* Récap : sous-total, remise, HT/TVA, client (mêmes calculs que la Caisse) */}
            <View style={s.confirmRecap}>
              {(() => {
                const discAmt = pos.subtotal() - pos.total()
                const vat = vatBreakdown(pos.total(), tenant?.vatRate)
                return (
                  <>
                    {discAmt > 0 && (
                      <>
                        <View style={s.confirmLine}>
                          <Text style={s.confirmLineLabel}>{i('Sous-total', 'Subtotal', 'Subtotal', 'Subtotale')}</Text>
                          <Text style={s.confirmLineVal}>{fmt(pos.subtotal())}</Text>
                        </View>
                        <View style={s.confirmLine}>
                          <Text style={s.confirmLineLabel}>{i('Remise', 'Discount', 'Descuento', 'Sconto')} ({pos.discount}%)</Text>
                          <Text style={[s.confirmLineVal, { color: Colors.danger }]}>−{fmt(discAmt)}</Text>
                        </View>
                      </>
                    )}
                    {vat.rate > 0 && (
                      <>
                        <View style={s.confirmLine}>
                          <Text style={s.confirmLineLabel}>{i('Total HT', 'Net (excl. tax)', 'Total sin IVA', 'Totale netto')}</Text>
                          <Text style={s.confirmLineVal}>{fmt(vat.ht)}</Text>
                        </View>
                        <View style={s.confirmLine}>
                          <Text style={s.confirmLineLabel}>{i('TVA', 'VAT', 'IVA', 'IVA')} {vat.rate}%</Text>
                          <Text style={s.confirmLineVal}>{fmt(vat.tva)}</Text>
                        </View>
                      </>
                    )}
                    {pos.customer && (
                      <View style={s.confirmLine}>
                        <Text style={s.confirmLineLabel}>{i('Client', 'Customer', 'Cliente', 'Cliente')}</Text>
                        <Text style={s.confirmLineVal} numberOfLines={1}>{pos.customer.name}</Text>
                      </View>
                    )}
                  </>
                )
              })()}
            </View>

            <Text style={s.confirmAmount}>{fmt(pos.total())}</Text>
            <View style={s.confirmBtns}>
              <TouchableOpacity style={s.confirmCancel} onPress={() => setShowConfirm(false)}
                accessibilityRole="button" accessibilityLabel={i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}>
                <Text style={s.confirmCancelText}>
                  {i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmOk}
                disabled={isPending}
                onPress={handleConfirmSale}
                accessibilityRole="button" accessibilityLabel={i('Valider', 'Confirm', 'Confirmar', 'Conferma')}
              >
                <Text style={s.confirmOkText}>
                  ✓ {i('Valider', 'Confirm', 'Confirmar', 'Conferma')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Modal PIN sortie kiosque ── */}
      {showPinModal && (
        <View style={s.pinOverlay}>
          <View style={s.pinCard}>
            <Text style={s.pinTitle}>{i('Code PIN', 'PIN Code', 'Código PIN', 'Codice PIN')}</Text>
            <TextInput
              style={s.pinInput}
              value={pin}
              onChangeText={setPin}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              autoFocus
              placeholderTextColor={Colors.text3}
              placeholder="••••"
              accessibilityLabel={i('Code PIN', 'PIN Code', 'Código PIN', 'Codice PIN')}
            />
            <View style={s.pinBtns}>
              <TouchableOpacity style={s.pinCancel} onPress={() => { setShowPinModal(false); setPin('') }}
                accessibilityRole="button" accessibilityLabel={i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}>
                <Text style={s.pinCancelText}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.pinOk} onPress={handleExit}
                accessibilityRole="button" accessibilityLabel="OK">
                <Text style={s.pinOkText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Sélecteur de client (réutilise le composant de la Caisse) ── */}
      {showCustomerPicker && (
        <CustomerPicker
          visible={showCustomerPicker}
          selectedId={pos.customer?.id ?? null}
          onClose={() => setShowCustomerPicker(false)}
          onSelect={(c) => { pos.setCustomer(c); setShowCustomerPicker(false) }}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg2 },
  layout: { flex: 1, flexDirection: 'row' },

  // Colonne produits (70%)
  productsCol: { flex: 7, borderRightWidth: 1, borderRightColor: Colors.border },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md,
    backgroundColor: Colors.bg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  searchInput: {
    flex: 1, fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: Colors.text,
    backgroundColor: Colors.bg3, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 40,
  },
  exitBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  exitBtnText: { fontSize: 20 },
  tapCountBadge: {
    position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.warn, alignItems: 'center', justifyContent: 'center',
  },
  tapCountText: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: Colors.black },
  grid: { padding: Spacing.md, paddingBottom: 40 },
  gridState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  productCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.sm,
    alignItems: 'center', position: 'relative', minHeight: 110,
  },
  productCardActive: { borderColor: Colors.primary, backgroundColor: 'rgba(108,71,255,0.08)' },
  productCardDisabled: { opacity: 0.4 },
  productEmoji: { fontSize: 32, marginBottom: 4 },
  cartBadge: {
    position: 'absolute', top: -4, right: -4, backgroundColor: Colors.primary,
    width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  cartBadgeText: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: Colors.white },
  productName: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: Colors.text, textAlign: 'center', marginBottom: 2 },
  productPrice: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: Colors.accent, letterSpacing: -0.3 },

  // Colonne panier (30%)
  cartCol: { flex: 3, backgroundColor: Colors.bg, flexDirection: 'column' },
  cartTitle: {
    fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: Colors.text,
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cartEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  cartEmptyText: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.text3 },
  cartRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  cartEmoji: { fontSize: 20, width: 28 },
  cartName: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text },
  cartSubtotal: { fontSize: FontSize.xs, fontFamily: 'JetBrainsMono_400Regular', color: Colors.text3, marginTop: 1 },
  cartQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: {
    width: 32, height: 32, borderRadius: BorderRadius.sm, backgroundColor: Colors.bg3,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  qtyBtnPlus: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  qtyBtnText: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: Colors.text },
  qtyText: { fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', color: Colors.text, minWidth: 24, textAlign: 'center' },
  cartFooter: { padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm },

  // Client + remise (réutilisent posStore.customer/discount)
  custChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bg3, borderRadius: BorderRadius.md, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  custName: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text },
  custSub: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: Colors.text3, marginTop: 1 },
  custRemove: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: Colors.text3 },
  custBtn: {
    height: 40, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg3,
  },
  custBtnTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: Colors.primary3 },
  discountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discountLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text2 },
  discountInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: Colors.bg3, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, height: 36, minWidth: 72,
  },
  discountInput: { flex: 1, fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', color: Colors.text, textAlign: 'right' },
  discountPct: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text3 },

  payRow: { flexDirection: 'row', gap: Spacing.xs },
  payBtn: {
    flex: 1, height: 44, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bg3, alignItems: 'center', justifyContent: 'center',
  },
  payBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(108,71,255,0.12)' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  totalLabel: { fontSize: FontSize.md, fontFamily: 'Outfit_700Bold', color: Colors.text },
  totalAmount: { fontSize: FontSize.xl, fontFamily: 'JetBrainsMono_700Bold', color: Colors.accent, letterSpacing: -0.5 },
  checkoutBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, height: 54,
    alignItems: 'center', justifyContent: 'center', ...Shadow.colored(Colors.primary),
  },
  checkoutBtnText: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: Colors.white },
  clearBtn: { height: 40, alignItems: 'center', justifyContent: 'center' },
  clearBtnText: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.danger },

  // Modal confirmation
  confirmOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  confirmCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.xxxl,
    width: 320, alignItems: 'center', gap: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  confirmTitle: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: Colors.text },
  confirmRecap: { width: '100%', gap: Spacing.xs },
  confirmLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  confirmLineLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.text3 },
  confirmLineVal: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_400Regular', color: Colors.text2, flexShrink: 1 },
  confirmAmount: { fontSize: 36, fontFamily: 'JetBrainsMono_700Bold', color: Colors.accent, letterSpacing: -1 },
  confirmBtns: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  confirmCancel: { flex: 1, height: 52, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { fontSize: FontSize.md, fontFamily: 'Outfit_600SemiBold', color: Colors.text3 },
  confirmOk: { flex: 2, height: 52, borderRadius: BorderRadius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadow.colored(Colors.primary) },
  confirmOkText: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: Colors.white },

  // Modal PIN
  pinOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  pinCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.xxxl,
    width: 280, alignItems: 'center', gap: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  pinTitle: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: Colors.text },
  pinInput: {
    width: '100%', height: 52, backgroundColor: Colors.bg3, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, fontSize: FontSize.xl, fontFamily: 'JetBrainsMono_700Bold',
    color: Colors.text, textAlign: 'center', letterSpacing: 8,
  },
  pinBtns: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  pinCancel: { flex: 1, height: 48, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  pinCancelText: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text3 },
  pinOk: { flex: 1, height: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  pinOkText: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: Colors.white },
})
