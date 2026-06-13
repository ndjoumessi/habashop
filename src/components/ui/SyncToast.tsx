import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useI18n, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize, Shadow } from '@/constants/theme'
import type { SyncSignal } from '@/hooks/useOfflineSync'

// Toast discret « X vente(s) synchronisée(s) » présenté après une resync réussie de la file
// offline. Monté en permanence (sibling du Stack) mais invisible tant qu'aucun signal :
// purement décoratif, ne capte pas les touches (pointerEvents none).
const VISIBLE_MS = 3000

export default function SyncToast({ signal }: { signal: SyncSignal | null }) {
  const { C } = useTheme()
  const { i } = useI18n()
  const insets = useSafeAreaInsets()
  const s = useMemo(() => makeStyles(C), [C])
  const opacity = useRef(new Animated.Value(0)).current
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!signal || signal.count <= 0) return
    setCount(signal.count)
    opacity.setValue(0)
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start()
    const id = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start()
    }, VISIBLE_MS)
    return () => clearTimeout(id)
    // signal.at = nonce → re-déclenche même pour deux batches de taille identique.
  }, [signal?.at, signal?.count, opacity])

  if (count <= 0) return null

  return (
    <Animated.View
      pointerEvents="none"
      style={[s.wrap, { top: insets.top + Spacing.sm, opacity }]}
    >
      <View style={s.toast}>
        <Ionicons name="cloud-done-outline" size={18} color={C.white} />
        <Text style={s.txt}>
          {count} {i(
            count > 1 ? 'ventes synchronisées' : 'vente synchronisée',
            count > 1 ? 'sales synced' : 'sale synced',
            count > 1 ? 'ventas sincronizadas' : 'venta sincronizada',
            count > 1 ? 'vendite sincronizzate' : 'vendita sincronizzata',
          )}
        </Text>
      </View>
    </Animated.View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 999 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: C.accent2,
    ...Shadow.md,
  },
  txt: { fontSize: FontSize.sm, fontFamily: 'Outfit_700Bold', color: C.white },
})
