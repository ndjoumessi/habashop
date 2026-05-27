import { View, Text, Modal, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import type { CartItem } from '@/stores/posStore'
import { Colors, Spacing, BorderRadius, FontSize, Shadow, withAlpha } from '@/constants/theme'
import { PAY_MODES } from './payModes'

interface POSConfirmModalProps {
  visible:     boolean
  onClose:     () => void
  onConfirm:   () => void
  isSelling:   boolean
  cart:        CartItem[]
  total:       number
  paymentMode: string
  fmt:         (n: number) => string
  i:           (fr: string, en: string, es: string, it: string) => string
}

export default function POSConfirmModal({
  visible, onClose, onConfirm, isSelling, cart, total, paymentMode, fmt, i,
}: POSConfirmModalProps) {
  const totalQty = cart.reduce((n, c) => n + c.quantity, 0)
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
              {(() => { const m = PAY_MODES.find(x => x.id === paymentMode)!; return `${m.icon} ${i(m.fr, m.en, m.es, m.it)}` })()}
            </Text>
          </View>
          <View style={[s.confirmRow, s.recapTotal]}>
            <Text style={s.recapTotalLabel}>Total</Text>
            <Text style={s.recapTotalVal}>{fmt(total)}</Text>
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
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityState={{ disabled: isSelling, busy: isSelling }}
              accessibilityLabel={i('Valider la vente', 'Confirm sale', 'Validar venta', 'Conferma vendita')}
            >
              {isSelling
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <Text style={s.confirmOkTxt}>{i('Valider', 'Confirm', 'Validar', 'Conferma')}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  confirmBackdrop: { flex: 1, backgroundColor: withAlpha(Colors.black, 0.6), alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  confirmCard: {
    width: '100%', maxWidth: 360, backgroundColor: Colors.card, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.xl, gap: Spacing.sm, ...Shadow.lg,
  },
  confirmTitle: { fontSize: FontSize.lg, fontFamily: 'Outfit_800ExtraBold', color: Colors.text, marginBottom: Spacing.xs },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  recapLabel: { fontSize: FontSize.sm, fontFamily: 'Outfit_400Regular', color: Colors.text3 },
  recapVal: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: Colors.text },
  recapTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: 2 },
  recapTotalLabel: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: Colors.text },
  recapTotalVal: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', color: Colors.primary3 },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  confirmBtn: { flex: 1, height: 48, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  confirmCancel: { backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border },
  confirmCancelTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_700Bold', color: Colors.text2 },
  confirmOk: { backgroundColor: Colors.accent2 },
  confirmOkTxt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: Colors.white },
})
