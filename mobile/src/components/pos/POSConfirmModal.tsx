import { useMemo } from 'react'
import { View, Text, Modal, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { vatBreakdown } from '@/stores/posStore'
import type { CartItem } from '@/stores/posStore'
import { useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, Shadow, withAlpha } from '@/constants/theme'
import { PAY_MODES } from './payModes'

interface POSConfirmModalProps {
  visible:     boolean
  onClose:     () => void
  onConfirm:   () => void
  isSelling:   boolean
  cart:        CartItem[]
  total:       number
  // Mode effectif de la vente : 'mixed' si paiement mixte (choisi côté panier), sinon le mode simple.
  paymentMode: string
  vatRate?:    number
  fmt:         (n: number) => string
  i:           (fr: string, en: string, es: string, it: string) => string
}

// Récap simple : la sélection du mode (et le split mixte) se fait désormais dans le panier.
export default function POSConfirmModal({
  visible, onClose, onConfirm, isSelling, cart, total, paymentMode, vatRate, fmt, i,
}: POSConfirmModalProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const totalQty = cart.reduce((n, c) => n + c.quantity, 0)
  const vat = vatBreakdown(total, vatRate)

  // Libellé paiement : 'mixed' → « Mixte » ; sinon le mode simple (find sûr).
  const payMode = PAY_MODES.find(x => x.id === paymentMode)
  const payLabel = paymentMode === 'mixed'
    ? i('Mixte', 'Split', 'Mixto', 'Misto')
    : payMode ? `${payMode.icon} ${i(payMode.fr, payMode.en, payMode.es, payMode.it)}` : paymentMode

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
            <Text style={s.recapVal}>{payLabel}</Text>
          </View>
          {vat.rate > 0 && (
            <View style={s.confirmRow}>
              <Text style={s.recapLabel}>{i('Dont TVA', 'Incl. VAT', 'IVA incl.', 'IVA incl.')} {vat.rate}%</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={s.recapVal}>{fmt(vat.tva)}</Text>
            </View>
          )}
          <View style={[s.confirmRow, s.recapTotal]}>
            <Text style={s.recapTotalLabel}>Total{vat.rate > 0 ? ' ' + i('TTC', 'incl. tax', 'con IVA', 'IVA incl.') : ''}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={s.recapTotalVal}>{fmt(total)}</Text>
          </View>

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
              style={[s.confirmBtn, s.confirmOk, isSelling && { opacity: 0.6 }]}
              disabled={isSelling}
              onPress={() => onConfirm()}
              accessibilityRole="button"
              accessibilityState={{ disabled: isSelling, busy: isSelling }}
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
  confirmTitle: { fontSize: FontSize.lg, fontFamily: 'Geist_800ExtraBold', color: C.text, marginBottom: Spacing.xs },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  recapLabel: { fontSize: FontSize.sm, fontFamily: 'Geist_400Regular', color: C.text3 },
  recapVal: { fontSize: FontSize.sm, fontFamily: 'Geist_600SemiBold', color: C.text },
  recapTotal: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: Spacing.sm, marginTop: 2 },
  recapTotalLabel: { fontSize: FontSize.md, fontFamily: 'Geist_800ExtraBold', color: C.text },
  recapTotalVal: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', color: C.primary3 },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  confirmBtn: { flex: 1, height: 48, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  confirmCancel: { backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border },
  confirmCancelTxt: { fontSize: FontSize.md, fontFamily: 'Geist_700Bold', color: C.text2 },
  confirmOk: { backgroundColor: C.accent2 },
  confirmOkTxt: { fontSize: FontSize.md, fontFamily: 'Geist_800ExtraBold', color: C.white },
})
