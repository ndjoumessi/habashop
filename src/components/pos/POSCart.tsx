import { View, Text, Modal, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { CartItem } from '@/stores/posStore'
import { Colors, Spacing, BorderRadius, FontSize, Shadow, withAlpha } from '@/constants/theme'
import { PAY_MODES } from './payModes'

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
        <Pressable style={s.qtyBtn} onPress={onDec} hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${i('Diminuer', 'Decrease', 'Disminuir', 'Diminuisci')} ${item.name?.trim()}`}>
          <Ionicons name="remove" size={16} color={Colors.text} />
        </Pressable>
        <Text style={s.qtyVal}>{item.quantity}</Text>
        <Pressable style={s.qtyBtn} onPress={onInc} hitSlop={8}
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

interface POSCartProps {
  visible:          boolean
  onClose:          () => void
  onCheckout:       () => void
  cart:             CartItem[]
  paymentMode:      string
  cashGiven:        number
  subtotal:         number
  total:            number
  onUpdateQty:      (id: string, qty: number) => void
  onRemove:         (id: string) => void
  onSetPaymentMode: (mode: any) => void
  onSetCashGiven:   (n: number) => void
  onClearCart:      () => void
  fmt:              (n: number) => string
  i:                (fr: string, en: string, es: string, it: string) => string
}

export default function POSCart({
  visible, onClose, onCheckout, cart, paymentMode, cashGiven, subtotal, total,
  onUpdateQty, onRemove, onSetPaymentMode, onSetCashGiven, onClearCart, fmt, i,
}: POSCartProps) {
  const insets = useSafeAreaInsets()
  const totalQty = cart.reduce((n, c) => n + c.quantity, 0)
  const discAmt = subtotal - total
  const change = cashGiven - total

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.sheet}>
        <View style={s.sheetHead}>
          <Text style={s.sheetTitle}>{i('Panier', 'Cart', 'Carrito', 'Carrello')} ({totalQty})</Text>
          <Pressable onPress={onClose} hitSlop={8}
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
              onInc={() => onUpdateQty(item.productId, item.quantity + 1)}
              onDec={() => onUpdateQty(item.productId, item.quantity - 1)}
              onDel={() => onRemove(item.productId)}
            />
          ))}
        </ScrollView>

        {cart.length > 0 && (
          <View style={[s.sheetFoot, { paddingBottom: insets.bottom + Spacing.md }]}>
            {/* Récap montants */}
            <View style={s.recapRow}>
              <Text style={s.recapLabel}>{i('Sous-total', 'Subtotal', 'Subtotal', 'Subtotale')}</Text>
              <Text style={s.recapVal}>{fmt(subtotal)}</Text>
            </View>
            {discAmt > 0 && (
              <View style={s.recapRow}>
                <Text style={s.recapLabel}>{i('Remise', 'Discount', 'Descuento', 'Sconto')}</Text>
                <Text style={[s.recapVal, { color: Colors.accent2 }]}>− {fmt(discAmt)}</Text>
              </View>
            )}
            <View style={[s.recapRow, s.recapTotal]}>
              <Text style={s.recapTotalLabel}>Total</Text>
              <Text style={s.recapTotalVal}>{fmt(total)}</Text>
            </View>

            {/* Modes de paiement */}
            <View style={s.payGrid}>
              {PAY_MODES.map(m => {
                const on = paymentMode === m.id
                return (
                  <Pressable
                    key={m.id}
                    style={[s.payChip, on && s.payChipOn]}
                    onPress={() => onSetPaymentMode(m.id)}
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
                    onChangeText={t => onSetCashGiven(Number(t.replace(/[^0-9.]/g, '')) || 0)}
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
              onPress={onCheckout}
              accessibilityRole="button"
              accessibilityLabel={`${i('Encaisser', 'Checkout', 'Cobrar', 'Incassare')} ${fmt(total)}`}
            >
              <Text style={s.payBtnTxt}>{i('Encaisser', 'Checkout', 'Cobrar', 'Incassare')} {fmt(total)}</Text>
            </Pressable>
            <Pressable style={s.clearBtn} onPress={onClearCart}
              accessibilityRole="button"
              accessibilityLabel={i('Vider le panier', 'Clear cart', 'Vaciar carrito', 'Svuota carrello')}>
              <Text style={s.clearTxt}>{i('Vider le panier', 'Clear cart', 'Vaciar carrito', 'Svuota carrello')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  emptyTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.text3, textAlign: 'center', paddingVertical: Spacing.xxxl },
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
  payChipOn: { backgroundColor: withAlpha(Colors.primary, 0.15), borderColor: Colors.primary },
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
})
