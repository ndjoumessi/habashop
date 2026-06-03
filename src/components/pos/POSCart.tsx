import { useMemo, useState } from 'react'
import { View, Text, Modal, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { vatBreakdown } from '@/stores/posStore'
import type { CartItem, PaymentMode } from '@/stores/posStore'
import type { Customer } from '@/types'
import { useTheme, useFmt } from '@/stores/appStore'
import { convertToXOF } from '@/services/exchangeRate'
import { ThemeColors, Spacing, BorderRadius, FontSize, Shadow, withAlpha } from '@/constants/theme'
import AccessibleButton from '@/components/ui/AccessibleButton'
import { PAY_MODES } from './payModes'

// ── Ligne panier ─────────────────────────────────
function CartRow({
  item, fmt, i, onInc, onDec, onDel,
}: {
  item: CartItem; fmt: (n: number) => string
  i: (fr: string, en: string, es: string, it: string) => string
  onInc: () => void; onDec: () => void; onDel: () => void
}) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  // Bouton « + » bloqué quand la quantité atteint le stock (cohérent avec le plafond du store).
  const atMax = item.stockQty > 0 && item.quantity >= item.stockQty
  return (
    <View style={s.cartRow}>
      <Text style={{ fontSize: 26 }}>{item.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.cartName} numberOfLines={1}>{item.name?.trim()}</Text>
        <Text style={s.cartLine}>{fmt(item.price)} × {item.quantity} = {fmt(item.price * item.quantity)}</Text>
        {(item.hasPromotion && item.promotionPrice != null) ? (
          <Text style={s.cartTag}>{i('Promo', 'Promo', 'Promo', 'Promo')}</Text>
        ) : item.tierLabel ? (
          <Text style={s.cartTag}>{item.tierLabel}</Text>
        ) : null}
        {atMax && <Text style={s.cartMax}>{i('Stock max', 'Max stock', 'Stock máx.', 'Stock max')}</Text>}
      </View>
      <View style={s.qtyBox}>
        <Pressable style={s.qtyBtn} onPress={onDec} hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${i('Diminuer', 'Decrease', 'Disminuir', 'Diminuisci')} ${item.name?.trim()}`}>
          <Ionicons name="remove" size={16} color={C.text} />
        </Pressable>
        <Text style={s.qtyVal}>{item.quantity}</Text>
        <Pressable style={[s.qtyBtn, atMax && s.qtyBtnDisabled]} onPress={onInc} hitSlop={8}
          disabled={atMax}
          accessibilityRole="button"
          accessibilityState={{ disabled: atMax }}
          accessibilityLabel={`${i('Augmenter', 'Increase', 'Aumentar', 'Aumenta')} ${item.name?.trim()}`}>
          <Ionicons name="add" size={16} color={atMax ? C.text3 : C.text} />
        </Pressable>
      </View>
      <Pressable onPress={onDel} hitSlop={8} style={s.delBtn}
        accessibilityRole="button"
        accessibilityLabel={`${i('Supprimer', 'Remove', 'Eliminar', 'Rimuovi')} ${item.name?.trim()}`}>
        <Ionicons name="trash-outline" size={16} color={C.danger} />
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
  onSetPaymentMode: (mode: PaymentMode) => void
  onSetCashGiven:   (n: number) => void
  onClearCart:      () => void
  customer?:        Customer | null
  onOpenCustomer:   () => void
  onClearCustomer:  () => void
  discount:         number
  onSetDiscount:    (d: number) => void
  vatRate?:         number
  fmt:              (n: number) => string
  i:                (fr: string, en: string, es: string, it: string) => string
}

export default function POSCart({
  visible, onClose, onCheckout, cart, paymentMode, cashGiven, subtotal, total,
  onUpdateQty, onRemove, onSetPaymentMode, onSetCashGiven, onClearCart,
  customer, onOpenCustomer, onClearCustomer, discount, onSetDiscount, vatRate, fmt, i,
}: POSCartProps) {
  const { C } = useTheme()
  const { currency, rates } = useFmt()
  const s = useMemo(() => makeStyles(C), [C])
  const insets = useSafeAreaInsets()
  const [showDetail, setShowDetail] = useState(false) // HT/TVA repliés par défaut (réduit la charge)
  const totalQty = cart.reduce((n, c) => n + c.quantity, 0)
  const discAmt = subtotal - total
  const vat = vatBreakdown(total, vatRate)
  // `cashGiven` est saisi dans la devise d'AFFICHAGE → on le ramène en XOF de base pour
  // comparer/monnaie (total est en XOF). En XOF/XAF la conversion est l'identité.
  const cashGivenXOF = convertToXOF(cashGiven, currency, rates)
  const change = cashGivenXOF - total
  // Garde espèces : en mode cash, montant reçu < total → encaissement bloqué.
  const cashShort = paymentMode === 'cash' && cashGivenXOF < total

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={s.sheet}>
        <View style={s.sheetHead}>
          <Text style={s.sheetTitle}>{i('Panier', 'Cart', 'Carrito', 'Carrello')} ({totalQty})</Text>
          <Pressable onPress={onClose} hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
            <Ionicons name="close" size={24} color={C.text} />
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
            {/* Client (optionnel) */}
            {customer ? (
              <View style={s.custChip}>
                <Ionicons name="person" size={16} color={C.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={s.custName} numberOfLines={1}>{customer.name}</Text>
                  <Text style={s.custSub} numberOfLines={1}>
                    {customer.loyaltyPoints ?? 0} {i('points', 'points', 'puntos', 'punti')}
                    {customer.type ? ` · ${customer.type}` : ''}
                  </Text>
                </View>
                <Pressable onPress={onOpenCustomer} hitSlop={8} accessibilityRole="button"
                  accessibilityLabel={i('Changer de client', 'Change customer', 'Cambiar cliente', 'Cambia cliente')}>
                  <Text style={s.custChange}>{i('Changer', 'Change', 'Cambiar', 'Cambia')}</Text>
                </Pressable>
                <Pressable onPress={onClearCustomer} hitSlop={8} accessibilityRole="button"
                  accessibilityLabel={i('Retirer le client', 'Remove customer', 'Quitar cliente', 'Rimuovi cliente')}>
                  <Ionicons name="close-circle" size={18} color={C.text3} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={s.custBtn} onPress={onOpenCustomer} accessibilityRole="button"
                accessibilityLabel={i('Ajouter un client', 'Add a customer', 'Añadir un cliente', 'Aggiungi un cliente')}>
                <Ionicons name="person-add-outline" size={16} color={C.primary} />
                <Text style={s.custBtnTxt}>
                  {i('Ajouter un client (optionnel)', 'Add a customer (optional)', 'Añadir un cliente (opcional)', 'Aggiungi un cliente (opzionale)')}
                </Text>
              </Pressable>
            )}

            {/* Remise (%) */}
            <View style={s.discountRow}>
              <Text style={s.recapLabel}>{i('Remise', 'Discount', 'Descuento', 'Sconto')} (%)</Text>
              <View style={s.discountInputWrap}>
                <TextInput
                  style={s.discountInput}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={C.text3}
                  value={discount ? String(discount) : ''}
                  onChangeText={t => {
                    const n = Math.max(0, Math.min(100, Number(t.replace(/[^0-9.]/g, '')) || 0))
                    onSetDiscount(n)
                  }}
                  accessibilityLabel={i('Remise en pourcentage', 'Discount percentage', 'Descuento en porcentaje', 'Sconto in percentuale')}
                />
                <Text style={s.discountPct}>%</Text>
              </View>
            </View>

            {/* Récap montants */}
            <View style={s.recapRow}>
              <Text style={s.recapLabel}>{i('Sous-total', 'Subtotal', 'Subtotal', 'Subtotale')}</Text>
              <Text style={s.recapVal}>{fmt(subtotal)}</Text>
            </View>
            {discAmt > 0 && (
              <View style={s.recapRow}>
                <Text style={s.recapLabel}>{i('Remise', 'Discount', 'Descuento', 'Sconto')}</Text>
                <Text style={[s.recapVal, { color: C.accent2 }]}>− {fmt(discAmt)}</Text>
              </View>
            )}
            {vat.rate > 0 && (
              <>
                <Pressable
                  style={s.detailToggle}
                  onPress={() => setShowDetail(v => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showDetail }}
                  accessibilityLabel={i('Détail TVA', 'VAT details', 'Detalle IVA', 'Dettaglio IVA')}
                >
                  <Text style={s.detailToggleTxt}>{i('Détail TVA', 'VAT details', 'Detalle IVA', 'Dettaglio IVA')}</Text>
                  <Ionicons name={showDetail ? 'chevron-up' : 'chevron-down'} size={14} color={C.text3} />
                </Pressable>
                {showDetail && (
                  <>
                    <View style={s.recapRow}>
                      <Text style={s.recapLabel}>{i('Total HT', 'Net (excl. tax)', 'Total sin IVA', 'Totale netto')}</Text>
                      <Text style={s.recapVal}>{fmt(vat.ht)}</Text>
                    </View>
                    <View style={s.recapRow}>
                      <Text style={s.recapLabel}>{i('TVA', 'VAT', 'IVA', 'IVA')} {vat.rate}%</Text>
                      <Text style={s.recapVal}>{fmt(vat.tva)}</Text>
                    </View>
                  </>
                )}
              </>
            )}
            <View style={[s.recapRow, s.recapTotal]}>
              <Text style={s.recapTotalLabel}>Total{vat.rate > 0 ? ' ' + i('TTC', 'incl. tax', 'con IVA', 'IVA incl.') : ''}</Text>
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
                    placeholderTextColor={C.text3}
                    value={cashGiven ? String(cashGiven) : ''}
                    onChangeText={t => onSetCashGiven(Number(t.replace(/[^0-9.]/g, '')) || 0)}
                    accessibilityLabel={i('Montant donné', 'Amount given', 'Monto entregado', 'Importo dato')}
                  />
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.recapLabel}>{i('Monnaie', 'Change', 'Cambio', 'Resto')}</Text>
                  <Text style={[s.changeVal, { color: change >= 0 ? C.accent2 : C.danger }]}>
                    {fmt(Math.max(0, change))}
                  </Text>
                </View>
              </View>
            )}

            {cashShort && (
              <Text style={s.cashWarn}>
                {i(
                  'Montant reçu insuffisant',
                  'Insufficient amount received',
                  'Monto recibido insuficiente',
                  'Importo ricevuto insufficiente',
                )}
              </Text>
            )}
            <AccessibleButton
              label={`${i('Encaisser', 'Checkout', 'Cobrar', 'Incassare')} ${fmt(total)}`}
              onPress={onCheckout}
              disabled={cashShort}
            />
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

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  emptyTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3, textAlign: 'center', paddingVertical: Spacing.xxxl },
  sheet: { flex: 1, backgroundColor: C.bg },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  sheetTitle: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  sheetFoot: {
    padding: Spacing.lg, gap: Spacing.sm,
    borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg2,
  },
  cartRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: C.card, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: C.border, padding: Spacing.md,
  },
  cartName: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.text },
  cartLine: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 2 },
  cartTag: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.accent2, marginTop: 2 },
  cartMax: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.warn, marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: C.bg4,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyVal: { fontSize: FontSize.sm, fontFamily: 'JetBrainsMono_700Bold', color: C.text, minWidth: 18, textAlign: 'center' },
  delBtn: { padding: 4 },

  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recapLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3 },
  recapVal: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text },
  recapTotal: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: Spacing.sm, marginTop: 2 },
  detailToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 2 },
  detailToggleTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text3 },
  recapTotalLabel: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  recapTotalVal: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', color: C.primary3 },

  payGrid: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  payChip: {
    flex: 1, alignItems: 'center', gap: 3, paddingVertical: Spacing.sm,
    backgroundColor: C.bg3, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border,
  },
  payChipOn: { backgroundColor: withAlpha(C.primary, 0.15), borderColor: C.primary },
  payTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text3 },
  payTxtOn: { color: C.primary3 },

  cashWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md, marginTop: Spacing.xs },
  cashInput: {
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, height: 44, marginTop: 4,
    fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', color: C.text,
  },
  changeVal: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', marginTop: 4 },

  payBtn: {
    backgroundColor: C.primary, borderRadius: BorderRadius.md, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, ...Shadow.colored(C.primary),
  },
  payBtnTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.white },
  payBtnDisabled: { opacity: 0.45 },
  cashWarn: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.danger, textAlign: 'center' },
  custBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: C.border, borderStyle: 'dashed', backgroundColor: C.bg3,
  },
  custBtnTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.primary3 },
  custChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: withAlpha(C.primary, 0.4), backgroundColor: withAlpha(C.primary, 0.08),
  },
  custName: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.text },
  custSub: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 1 },
  custChange: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.primary3 },
  discountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  discountInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.bg3, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: Spacing.md, height: 38, minWidth: 80,
  },
  discountInput: {
    flex: 1, textAlign: 'right', fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', color: C.text, padding: 0,
  },
  discountPct: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.text3 },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  clearTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.danger },
})
