import { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { ReactNode } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, useI18n } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize } from '@/constants/theme'

interface ScreenHeaderProps {
  title:     string
  subtitle?: string
  onBack?:   () => void                         // affiche le bouton retour si fourni
  backIcon?: keyof typeof Ionicons.glyphMap      // défaut : chevron-back (ex. 'close' pour la Caisse)
  icon?:     keyof typeof Ionicons.glyphMap      // icône de titre (écrans d'onglet sans retour)
  center?:   boolean                             // titre centré (Caisse)
  right?:    ReactNode                           // action(s) à droite (boutons 44px du même écran)
}

// En-tête d'écran standardisé : bouton retour/fermer 44px + titre (+ sous-titre) + action.
// Unifie les en-têtes auparavant réécrits par chaque écran (40 vs 44px, h1 incohérents).
export default function ScreenHeader({
  title, subtitle, onBack, backIcon = 'chevron-back', icon, center, right,
}: ScreenHeaderProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  return (
    <View style={s.header}>
      {onBack && (
        <Pressable
          style={s.backBtn}
          onPress={onBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={backIcon === 'close'
            ? i('Fermer', 'Close', 'Cerrar', 'Chiudi')
            : i('Retour', 'Back', 'Atrás', 'Indietro')}
        >
          <Ionicons name={backIcon} size={22} color={C.text} />
        </Pressable>
      )}
      <View style={s.titleBlock}>
        <View style={[s.titleRow, center && s.titleRowCenter]}>
          {icon && <Ionicons name={icon} size={20} color={C.text} />}
          <Text style={[s.title, center && s.titleCenter]} numberOfLines={1}>{title}</Text>
        </View>
        {subtitle && <Text style={[s.subtitle, center && s.titleCenter]} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right ? <View style={s.right}>{right}</View> : (center && onBack ? <View style={s.spacer} /> : null)}
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: C.bg3,
    borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center',
  },
  titleBlock: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  titleRowCenter: { justifyContent: 'center' },
  title: { fontSize: FontSize.xxl, fontFamily: 'Outfit_800ExtraBold', color: C.text },
  titleCenter: { textAlign: 'center' },
  subtitle: { fontSize: FontSize.xs, fontFamily: 'Outfit_400Regular', color: C.text3, marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  spacer: { width: 44, height: 44 },
})
