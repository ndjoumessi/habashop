import { useMemo, useState } from 'react'
import {
  View, Text, Modal, Pressable, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import AccessibleButton from '@/components/ui/AccessibleButton'
import InvoiceButton from '@/components/sales/InvoiceButton'
import { useI18n, useFmt, useTheme } from '@/stores/appStore'
import { isTrackingPayment } from '@/lib/refund'
import type { SaleRecord } from '@/types'
import { ThemeColors, Spacing, BorderRadius, FontSize, withAlpha } from '@/constants/theme'

interface RefundSheetProps {
  sale: SaleRecord
  saving: boolean
  onClose: () => void
  onConfirm: (reason: string, restock: boolean) => void
}

/**
 * Feuille de confirmation d'annulation/remboursement (TOTAL). Montée À LA DEMANDE
 * par le parent (`{target && <RefundSheet/>}`) — JAMAIS un Modal dormant (anti-crash
 * Fabric « child already has a parent »). Motif OBLIGATOIRE, case « Remettre en stock »
 * PRÉ-COCHÉE, note Wave/Orange si paiement mobile. Présentationnel : délègue à onConfirm.
 */
export default function RefundSheet({ sale, saving, onClose, onConfirm }: RefundSheetProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const { fmt } = useFmt()
  const [reason, setReason] = useState('')
  const [restock, setRestock] = useState(true) // pré-coché (ON par défaut)

  const isTracking = isTrackingPayment(sale.paymentMode)
  const canConfirm = reason.trim().length > 0 && !saving

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !saving && onClose()}>
      <KeyboardAvoidingView
        style={s.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.box}>
          {/* En-tête */}
          <View style={s.head}>
            <View style={s.headTitle}>
              <Ionicons name="refresh" size={18} color={C.danger} />
              <Text style={s.title}>{i('Rembourser la vente', 'Refund sale', 'Reembolsar venta', 'Rimborsa vendita')}</Text>
            </View>
            <Pressable onPress={onClose} disabled={saving} hitSlop={8}
              accessibilityRole="button" accessibilityLabel={i('Fermer', 'Close', 'Cerrar', 'Chiudi')}>
              <Ionicons name="close" size={24} color={C.text3} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: Spacing.md }}>
            {/* Récap vente */}
            <View style={s.recap}>
              <View style={s.recapRow}>
                <Text style={s.recapRef}>{i('Vente', 'Sale', 'Venta', 'Vendita')} #{sale.id.slice(-6).toUpperCase()}</Text>
                <Text style={s.recapTotal}>{fmt(sale.total ?? 0)}</Text>
              </View>
              <Text style={s.recapNote}>
                {i('Remboursement total — la vente est conservée mais exclue du chiffre d’affaires.',
                   'Total refund — the sale is kept but excluded from revenue.',
                   'Reembolso total — la venta se conserva pero se excluye de los ingresos.',
                   'Rimborso totale — la vendita è conservata ma esclusa dal fatturato.')}
              </Text>
            </View>

            {/* Facture PDF (tous rôles) — utile avant/après remboursement */}
            <InvoiceButton saleId={sale.id} />

            {/* Motif (obligatoire) */}
            <View style={{ gap: Spacing.xs }}>
              <Text style={s.label}>{i('Motif', 'Reason', 'Motivo', 'Motivo')} *</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                numberOfLines={3}
                editable={!saving}
                placeholder={i('Ex. produit défectueux, erreur de caisse…', 'E.g. faulty product, checkout error…', 'Ej. producto defectuoso, error de caja…', 'Es. prodotto difettoso, errore di cassa…')}
                placeholderTextColor={C.text3}
                style={s.input}
                accessibilityLabel={i('Motif du remboursement', 'Refund reason', 'Motivo del reembolso', 'Motivo del rimborso')}
              />
            </View>

            {/* Remettre en stock (pré-coché) */}
            <Pressable onPress={() => setRestock(r => !r)} disabled={saving}
              style={[s.restock, restock && s.restockOn]}
              accessibilityRole="checkbox" accessibilityState={{ checked: restock }}
              accessibilityLabel={i('Remettre les articles en stock', 'Return items to stock', 'Devolver artículos al stock', 'Rimetti gli articoli in stock')}>
              <View style={[s.checkbox, restock && s.checkboxOn]}>
                {restock && <Ionicons name="checkmark" size={14} color={C.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.restockTitle}>{i('Remettre les articles en stock', 'Return items to stock', 'Devolver artículos al stock', 'Rimetti gli articoli in stock')}</Text>
                <Text style={s.restockSub}>{i('Décochez si la marchandise est abîmée / non rendue.', 'Uncheck if goods are damaged / not returned.', 'Desmarque si la mercancía está dañada / no devuelta.', 'Deseleziona se la merce è danneggiata / non resa.')}</Text>
              </View>
            </Pressable>

            {/* Note Wave/Orange (suivi only) */}
            {isTracking && (
              <View style={s.trackingNote}>
                <Ionicons name="information-circle" size={16} color={C.warn} style={{ marginTop: 1 }} />
                <Text style={s.trackingTxt}>
                  {i('Paiement mobile (Wave/Orange) : ce remboursement est un SUIVI dans l’app. Le remboursement réel de l’argent se fait manuellement via l’opérateur.',
                     'Mobile payment (Wave/Orange): this refund is TRACKING only in the app. The actual money refund is done manually via the operator.',
                     'Pago móvil (Wave/Orange): este reembolso es solo SEGUIMIENTO en la app. El reembolso real del dinero se hace manualmente vía el operador.',
                     'Pagamento mobile (Wave/Orange): questo rimborso è solo TRACCIAMENTO nell’app. Il rimborso reale del denaro avviene manualmente tramite l’operatore.')}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={s.actions}>
              <AccessibleButton
                label={i('Annuler', 'Cancel', 'Cancelar', 'Annulla')}
                onPress={onClose}
                variant="ghost"
                disabled={saving}
                style={{ flex: 1 }}
              />
              <AccessibleButton
                label={saving
                  ? i('Remboursement…', 'Refunding…', 'Reembolsando…', 'Rimborso…')
                  : i('Confirmer', 'Confirm', 'Confirmar', 'Conferma')}
                onPress={() => onConfirm(reason.trim(), restock)}
                variant="danger"
                icon="refresh"
                loading={saving}
                disabled={!canConfirm}
                style={{ flex: 1 }}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: withAlpha('#000000', 0.6), justifyContent: 'center', padding: Spacing.lg },
  box: { backgroundColor: C.bg, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: C.border, padding: Spacing.lg, maxHeight: '88%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  headTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  title: { fontSize: FontSize.lg, fontFamily: 'Geist_800ExtraBold', color: C.text },

  recap: { backgroundColor: C.bg3, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: C.border, padding: Spacing.md, gap: Spacing.xs },
  recapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recapRef: { fontSize: FontSize.sm, fontFamily: 'Geist_600SemiBold', color: C.text3 },
  recapTotal: { fontSize: FontSize.lg, fontFamily: 'JetBrainsMono_700Bold', color: C.text },
  recapNote: { fontSize: FontSize.xs, fontFamily: 'Geist_400Regular', color: C.text3, lineHeight: 16 },

  label: { fontSize: FontSize.xs, fontFamily: 'Geist_700Bold', color: C.text3, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border, borderRadius: BorderRadius.md,
    padding: Spacing.md, minHeight: 84, textAlignVertical: 'top',
    fontSize: FontSize.md, fontFamily: 'Geist_400Regular', color: C.text,
  },

  restock: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border, borderRadius: BorderRadius.md, padding: Spacing.md, minHeight: 44 },
  restockOn: { backgroundColor: withAlpha(C.accent2, 0.12), borderColor: withAlpha(C.accent2, 0.4) },
  checkbox: { width: 22, height: 22, borderRadius: BorderRadius.sm, borderWidth: 1.5, borderColor: C.text3, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: C.accent2, borderColor: C.accent2 },
  restockTitle: { fontSize: FontSize.sm, fontFamily: 'Geist_700Bold', color: C.text },
  restockSub: { fontSize: FontSize.xs, fontFamily: 'Geist_400Regular', color: C.text3, marginTop: 2, lineHeight: 16 },

  trackingNote: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', backgroundColor: withAlpha(C.warn, 0.1), borderWidth: 1, borderColor: withAlpha(C.warn, 0.3), borderRadius: BorderRadius.md, padding: Spacing.md },
  trackingTxt: { flex: 1, fontSize: FontSize.xs, fontFamily: 'Geist_400Regular', color: C.text2, lineHeight: 17 },

  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
})
