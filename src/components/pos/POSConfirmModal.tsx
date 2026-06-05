import { useMemo, useState } from 'react'
import { View, Text, Modal, Pressable, TextInput, ActivityIndicator, StyleSheet } from 'react-native'
import { vatBreakdown } from '@/stores/posStore'
import type { CartItem } from '@/stores/posStore'
import { useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, Shadow, withAlpha } from '@/constants/theme'
import { PAY_MODES } from './payModes'
import {
  SPLIT_METHODS, buildMixedSplit, isMixedValid, type SplitMethod, type MixedSplit,
} from '@/lib/paymentSplit'

interface POSConfirmModalProps {
  visible:     boolean
  onClose:     () => void
  // override fourni uniquement en paiement mixte (paymentMode='mixed' + ventilation XOF).
  onConfirm:   (override?: { paymentMode: string } & MixedSplit) => void
  isSelling:   boolean
  cart:        CartItem[]
  total:       number
  paymentMode: string
  vatRate?:    number
  fmt:         (n: number) => string
  // Convertit un montant saisi (devise d'affichage) en XOF base (total est en XOF).
  toXOF:       (displayAmount: number) => number
  i:           (fr: string, en: string, es: string, it: string) => string
}

export default function POSConfirmModal({
  visible, onClose, onConfirm, isSelling, cart, total, paymentMode, vatRate, fmt, toXOF, i,
}: POSConfirmModalProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const totalQty = cart.reduce((n, c) => n + c.quantity, 0)
  const vat = vatBreakdown(total, vatRate)

  // ── État paiement mixte (local à la modale) ──
  const [mixed, setMixed] = useState(false)
  const [method1, setMethod1] = useState<SplitMethod>('cash')
  const [method2, setMethod2] = useState<SplitMethod>('mobile')
  const [amt, setAmt] = useState('') // montant ligne 1, en devise d'affichage

  const methodLabel = (m: SplitMethod): string =>
    m === 'cash' ? `💵 ${i('Espèces', 'Cash', 'Efectivo', 'Contanti')}`
    : m === 'card' ? `💳 ${i('Carte', 'Card', 'Tarjeta', 'Carta')}`
    : `📱 ${i('Mobile Money', 'Mobile Money', 'Dinero móvil', 'Mobile Money')}`

  // Montant ligne 1 en XOF (borné), reste auto en XOF.
  const amount1XOF = Math.min(total, Math.max(0, toXOF(Number(amt.replace(',', '.').replace(/[^0-9.]/g, '')) || 0)))
  const remainingXOF = Math.max(0, total - amount1XOF)
  const valid = isMixedValid(method1, method2, amount1XOF, total)

  // Sélection méthode ligne 1 : garde la ligne 2 différente.
  const pickMethod1 = (m: SplitMethod) => {
    setMethod1(m)
    if (method2 === m) setMethod2(SPLIT_METHODS.find(x => x !== m) ?? 'mobile')
  }

  const handleValidate = () => {
    if (mixed) {
      const split = buildMixedSplit(method1, amount1XOF, method2, total)
      onConfirm({ paymentMode: 'mixed', ...split })
    } else {
      onConfirm()
    }
  }

  const canValidate = !isSelling && (!mixed || valid)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
              {mixed
                ? i('Mixte', 'Split', 'Mixto', 'Misto')
                : (() => { const m = PAY_MODES.find(x => x.id === paymentMode)!; return `${m.icon} ${i(m.fr, m.en, m.es, m.it)}` })()}
            </Text>
          </View>
          {vat.rate > 0 && (
            <View style={s.confirmRow}>
              <Text style={s.recapLabel}>{i('Dont TVA', 'Incl. VAT', 'IVA incl.', 'IVA incl.')} {vat.rate}%</Text>
              <Text style={s.recapVal}>{fmt(vat.tva)}</Text>
            </View>
          )}
          <View style={[s.confirmRow, s.recapTotal]}>
            <Text style={s.recapTotalLabel}>Total{vat.rate > 0 ? ' ' + i('TTC', 'incl. tax', 'con IVA', 'IVA incl.') : ''}</Text>
            <Text style={s.recapTotalVal}>{fmt(total)}</Text>
          </View>

          {/* ── Toggle paiement mixte ── */}
          <Pressable
            style={[s.mixedToggle, mixed && s.mixedToggleOn]}
            onPress={() => setMixed(m => !m)}
            disabled={isSelling}
            accessibilityRole="switch"
            accessibilityState={{ checked: mixed, disabled: isSelling }}
            accessibilityLabel={i('Paiement mixte', 'Split payment', 'Pago mixto', 'Pagamento misto')}
          >
            <View style={[s.checkbox, mixed && s.checkboxOn]}>
              {mixed && <Text style={s.checkMark}>✓</Text>}
            </View>
            <Text style={s.mixedToggleTxt}>{i('Paiement mixte', 'Split payment', 'Pago mixto', 'Pagamento misto')}</Text>
          </Pressable>

          {/* ── Lignes de paiement mixte ── */}
          {mixed && (
            <View style={s.mixedBox}>
              {/* Ligne 1 : méthode + montant */}
              <Text style={s.lineLabel}>{i('Paiement 1', 'Payment 1', 'Pago 1', 'Pagamento 1')}</Text>
              <View style={s.methodRow}>
                {SPLIT_METHODS.map(m => (
                  <Pressable key={m} style={[s.methodChip, method1 === m && s.methodChipOn]} onPress={() => pickMethod1(m)}
                    accessibilityRole="button" accessibilityState={{ selected: method1 === m }} accessibilityLabel={methodLabel(m)}>
                    <Text style={[s.methodChipTxt, method1 === m && s.methodChipTxtOn]} numberOfLines={1}>{methodLabel(m)}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={s.amtInput}
                keyboardType="numeric"
                value={amt}
                onChangeText={t => setAmt(t.replace(/[^0-9.,]/g, ''))}
                placeholder={i('Montant reçu', 'Amount received', 'Importe recibido', 'Importo ricevuto')}
                placeholderTextColor={C.text3}
                editable={!isSelling}
                accessibilityLabel={i('Montant du paiement 1', 'Payment 1 amount', 'Importe del pago 1', 'Importo del pagamento 1')}
              />

              {/* Ligne 2 : méthode (≠ ligne 1) + reste auto (read-only, grisé) */}
              <Text style={s.lineLabel}>{i('Paiement 2', 'Payment 2', 'Pago 2', 'Pagamento 2')}</Text>
              <View style={s.methodRow}>
                {SPLIT_METHODS.filter(m => m !== method1).map(m => (
                  <Pressable key={m} style={[s.methodChip, method2 === m && s.methodChipOn]} onPress={() => setMethod2(m)}
                    accessibilityRole="button" accessibilityState={{ selected: method2 === m }} accessibilityLabel={methodLabel(m)}>
                    <Text style={[s.methodChipTxt, method2 === m && s.methodChipTxtOn]} numberOfLines={1}>{methodLabel(m)}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={s.remainingRow}>
                <Text style={s.remainingLabel}>{i('Reste (auto)', 'Remaining (auto)', 'Restante (auto)', 'Resto (auto)')}</Text>
                <Text style={s.remainingVal}>{fmt(remainingXOF)}</Text>
              </View>

              {!valid && (
                <Text style={s.mixedHint}>
                  {i('Saisis un montant entre 0 et le total, avec 2 méthodes différentes.',
                     'Enter an amount between 0 and the total, with two different methods.',
                     'Ingresa un importe entre 0 y el total, con dos métodos distintos.',
                     'Inserisci un importo tra 0 e il totale, con due metodi diversi.')}
                </Text>
              )}
            </View>
          )}

          <View style={s.confirmActions}>
            <Pressable
              style={[s.confirmBtn, s.confirmCancel]}
              disabled={isSelling}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
            >
              <Text style={s.confirmCancelTxt}>{i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}</Text>
            </Pressable>
            <Pressable
              style={[s.confirmBtn, s.confirmOk, !canValidate && { opacity: 0.5 }]}
              disabled={!canValidate}
              onPress={() => handleValidate()}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canValidate, busy: isSelling }}
              accessibilityLabel={i('Valider la vente', 'Confirm sale', 'Validar venta', 'Conferma vendita')}
            >
              {isSelling
                ? <ActivityIndicator color={C.white} size="small" />
                : <Text style={s.confirmOkTxt}>{i('Valider', 'Confirm', 'Validar', 'Conferma')}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  confirmBackdrop: { flex: 1, backgroundColor: withAlpha(C.black, 0.6), alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  confirmCard: {
    width: '100%', maxWidth: 360, backgroundColor: C.card, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: C.border, padding: Spacing.xl, gap: Spacing.sm, ...Shadow.lg,
  },
  confirmTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: C.text, marginBottom: Spacing.xs },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  recapLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3 },
  recapVal: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.text },
  recapTotal: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: Spacing.sm, marginTop: 2 },
  recapTotalLabel: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  recapTotalVal: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', color: C.primary3 },

  // Toggle mixte
  mixedToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, minHeight: 44, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border },
  mixedToggleOn: { backgroundColor: withAlpha(C.primary, 0.1), borderColor: withAlpha(C.primary, 0.4) },
  checkbox: { width: 20, height: 20, borderRadius: BorderRadius.sm, borderWidth: 1.5, borderColor: C.text3, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: C.primary, borderColor: C.primary },
  checkMark: { color: C.white, fontSize: 13, fontFamily: 'Outfit_800ExtraBold', lineHeight: 16 },
  mixedToggleTxt: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.text },

  // Bloc lignes mixtes
  mixedBox: { gap: Spacing.xs, padding: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border },
  lineLabel: { fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.xs },
  methodRow: { flexDirection: 'row', gap: Spacing.xs },
  methodChip: { flex: 1, minHeight: 40, paddingHorizontal: Spacing.xs, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  methodChipOn: { backgroundColor: withAlpha(C.primary, 0.14), borderColor: C.primary },
  methodChipTxt: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
  methodChipTxtOn: { color: C.primary3 },
  amtInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: BorderRadius.sm, height: 44, paddingHorizontal: Spacing.md, fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', color: C.text },
  remainingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xs },
  remainingLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: C.text3 },
  remainingVal: { fontSize: FontSize.md, fontFamily: 'JetBrainsMono_700Bold', color: C.text3 },
  mixedHint: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.warn, marginTop: 2, lineHeight: 16 },

  confirmActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  confirmBtn: { flex: 1, height: 48, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  confirmCancel: { backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border },
  confirmCancelTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_700Bold', color: C.text2 },
  confirmOk: { backgroundColor: C.accent2 },
  confirmOkTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.white },
})
