import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useI18n, useTheme } from '@/stores/appStore'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { usePendingSales } from '@/hooks/usePendingSales'
import { ThemeColors, Spacing, BorderRadius, FontSize } from '@/constants/theme'

interface OfflineBannerProps {
  // 'pos' annonce les ventes en file ; 'cache' indique des données potentiellement périmées.
  context?: 'pos' | 'cache'
}

// Bandeau « hors-ligne » partagé (POS / Stock / Clients). Affiché uniquement quand le réseau
// est absent. En contexte POS, mentionne le nombre de ventes en attente de synchro.
export default function OfflineBanner({ context = 'cache' }: OfflineBannerProps) {
  const { C } = useTheme()
  const { i } = useI18n()
  const s = useMemo(() => makeStyles(C), [C])
  const { isOnline } = useNetworkStatus()
  const pending = usePendingSales()

  if (isOnline) return null

  const message = context === 'pos'
    ? (pending > 0
        ? i(
            `Mode hors-ligne — ${pending} vente(s) en attente de synchro`,
            `Offline mode — ${pending} sale(s) waiting to sync`,
            `Modo sin conexión — ${pending} venta(s) pendiente(s) de sincronizar`,
            `Modalità offline — ${pending} vendita/e in attesa di sincronizzazione`,
          )
        : i(
            'Mode hors-ligne — les ventes seront synchronisées au retour du réseau',
            'Offline mode — sales will sync when the network is back',
            'Modo sin conexión — las ventas se sincronizarán al volver la red',
            'Modalità offline — le vendite si sincronizzeranno al ritorno della rete',
          ))
    : i(
        'Mode hors-ligne — données en cache (peuvent être périmées)',
        'Offline mode — cached data (may be outdated)',
        'Modo sin conexión — datos en caché (pueden estar desactualizados)',
        'Modalità offline — dati in cache (possono essere obsoleti)',
      )

  return (
    <View style={s.banner} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={16} color={C.white} />
      <Text style={s.txt} numberOfLines={2}>{message}</Text>
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: C.warn, borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.xs,
  },
  txt: { flex: 1, fontSize: FontSize.xs, fontFamily: 'Geist_700Bold', color: C.white },
})
