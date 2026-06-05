import { useMemo, useState } from 'react'
import { Pressable, Text, ActivityIndicator, StyleSheet, Alert, View, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useI18n, useTheme } from '@/stores/appStore'
import { shareInvoicePdf } from '@/services/invoicePdf'
import { logger } from '@/lib/logger'
import { ThemeColors, Spacing, BorderRadius, FontSize, withAlpha } from '@/constants/theme'

/**
 * Bouton « 📄 Facture » — télécharge la facture PDF d'une vente et ouvre le partage
 * système. Accessible à TOUS les rôles. État de chargement intégré (« Génération… »),
 * toast d'erreur localisé. Réutilisé dans la fiche vente et la feuille de remboursement.
 */
export default function InvoiceButton({ saleId, style }: { saleId: string; style?: StyleProp<ViewStyle> }) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const [busy, setBusy] = useState(false)

  const onPress = async () => {
    if (busy) return
    setBusy(true)
    try {
      await shareInvoicePdf(saleId, i('Facture', 'Invoice', 'Factura', 'Fattura'), Date.now())
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    } catch (e) {
      logger.warn('Facture PDF échouée:', e)
      Alert.alert(
        i('Erreur facture', 'Invoice error', 'Error de factura', 'Errore fattura'),
        i(
          'Impossible de générer la facture. Vérifiez la connexion et réessayez.',
          'Could not generate the invoice. Check your connection and try again.',
          'No se pudo generar la factura. Verifique la conexión e inténtelo de nuevo.',
          'Impossibile generare la fattura. Controlla la connessione e riprova.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Pressable style={[s.btn, busy && s.busy, style]} onPress={onPress} disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      accessibilityLabel={i('Facture PDF', 'PDF invoice', 'Factura PDF', 'Fattura PDF')}>
      <View style={s.content}>
        {busy ? (
          <>
            <ActivityIndicator color={C.accent3} />
            <Text style={s.txt}>{i('Génération…', 'Generating…', 'Generando…', 'Generazione…')}</Text>
          </>
        ) : (
          <Text style={s.txt}>📄 {i('Facture', 'Invoice', 'Factura', 'Fattura')}</Text>
        )}
      </View>
    </Pressable>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  btn: {
    backgroundColor: withAlpha(C.accent3, 0.12), borderWidth: 1, borderColor: withAlpha(C.accent3, 0.3),
    borderRadius: BorderRadius.md, height: 50, alignItems: 'center', justifyContent: 'center',
  },
  busy: { opacity: 0.7 },
  content: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  txt: { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold', color: C.accent3 },
})
