import { useState } from 'react'
import {
  View, Text, StyleSheet, FlatList,
  TextInput, TouchableOpacity, StatusBar, Alert,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Haptics from 'expo-haptics'
import { productsApi, salesApi } from '@/services/api'
import { usePosStore } from '@/stores/posStore'
import { useI18n, useFmt, useAppStore } from '@/stores/appStore'
import { Colors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme'

// ── Mode kiosque : POS plein écran simplifié pour un poste caissier fixe ──
// Affichage volontairement sombre/figé (pas de thème dynamique) — un kiosque
// reste sur un seul rendu. Sortie protégée par code PIN.
const EXIT_PIN = '1234'

export default function KioskScreen() {
  const qc       = useQueryClient()
  const { i }    = useI18n()
  const { fmt }  = useFmt()
  const pos      = usePosStore()
  const { setKioskMode } = useAppStore()

  const [search, setSearch]             = useState('')
  const [pin, setPin]                   = useState('')
  const [showPinModal, setShowPinModal] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ['products'],
    queryFn:  () => productsApi.list(),
    staleTime: 2 * 60 * 1000,
  })

  const filtered = (products as any[]).filter(p =>
    p.isActive !== false &&
    (!search || p.name?.toLowerCase().includes(search.toLowerCase())),
  )

  const { mutate: createSale, isPending } = useMutation({
    mutationFn: salesApi.create,
    onSuccess: () => {
      pos.recordSale(pos.total())
      pos.clearCart()
      setShowConfirm(false)
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    },
    onError: (err: any) => {
      Alert.alert(
        i('Erreur', 'Error', 'Error', 'Errore'),
        err?.response?.data?.error ?? i('Échec', 'Failed', 'Error', 'Errore'),
      )
    },
  })

  const handleExit = () => {
    if (pin === EXIT_PIN) {
      setKioskMode(false)
      setShowPinModal(false)
      setPin('')
    } else {
      Alert.alert(
        i('Code incorrect', 'Wrong PIN', 'PIN incorrecto', 'PIN errato'),
        i('Réessayez', 'Try again', 'Inténtelo de nuevo', 'Riprova'),
      )
      setPin('')
    }
  }

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
              placeholderTextColor={Colors.text4}
              value={search}
              onChangeText={setSearch}
            />
            <TouchableOpacity
              style={s.exitBtn}
              onLongPress={() => setShowPinModal(true)}
              delayLongPress={600}
              accessibilityRole="button"
              accessibilityLabel={i('Quitter le mode kiosque', 'Exit kiosk mode', 'Salir del modo kiosco', 'Esci dalla modalità kiosk')}
              accessibilityHint={i('Appui long', 'Long press', 'Pulsación larga', 'Pressione lunga')}
            >
              <Text style={s.exitBtnText}>⚙️</Text>
            </TouchableOpacity>
          </View>

          <FlatList
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
        </View>

        {/* ── Colonne droite : panier permanent ── */}
        <View style={s.cartCol}>
          <Text style={s.cartTitle}>
            {i('Panier', 'Cart', 'Carrito', 'Carrello')}
            {cartCount > 0 ? ` (${cartCount})` : ''}
          </Text>

          <FlatList
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
                    accessibilityRole="button"
                    accessibilityLabel={i('Diminuer', 'Decrease', 'Reducir', 'Riduci')}
                  >
                    <Text style={s.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={[s.qtyBtn, s.qtyBtnPlus]}
                    onPress={() => pos.updateQty(item.productId, item.quantity + 1)}
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
                onPress={() => createSale({
                  items: pos.cart.map(item => ({ productId: item.productId, qty: item.quantity, price: item.price })),
                  total: pos.total(),
                  paymentMode: pos.paymentMode,
                })}
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
              placeholderTextColor={Colors.text4}
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
  exitBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  exitBtnText: { fontSize: 20 },
  grid: { padding: Spacing.md, paddingBottom: 40 },
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
  cartBadgeText: { fontSize: 10, fontFamily: 'Outfit_700Bold', color: Colors.white },
  productName: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: Colors.text, textAlign: 'center', marginBottom: 2 },
  productPrice: { fontSize: 12, fontFamily: 'JetBrainsMono_700Bold', color: Colors.accent, letterSpacing: -0.3 },

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
  checkoutBtnText: { fontSize: FontSize.lg, fontFamily: 'Outfit_900Black', color: Colors.white },
  clearBtn: { height: 40, alignItems: 'center', justifyContent: 'center' },
  clearBtnText: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.danger },

  // Modal confirmation
  confirmOverlay: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  confirmCard: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.xxxl,
    width: 320, alignItems: 'center', gap: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  confirmTitle: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: Colors.text },
  confirmAmount: { fontSize: 36, fontFamily: 'JetBrainsMono_700Bold', color: Colors.accent, letterSpacing: -1 },
  confirmBtns: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  confirmCancel: { flex: 1, height: 52, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  confirmCancelText: { fontSize: FontSize.md, fontFamily: 'Outfit_600SemiBold', color: Colors.text3 },
  confirmOk: { flex: 2, height: 52, borderRadius: BorderRadius.lg, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadow.colored(Colors.primary) },
  confirmOkText: { fontSize: FontSize.md, fontFamily: 'Outfit_900Black', color: Colors.white },

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
  pinOkText: { fontSize: FontSize.md, fontFamily: 'Outfit_900Black', color: Colors.white },
})
