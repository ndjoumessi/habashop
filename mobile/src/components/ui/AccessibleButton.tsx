import { useMemo } from 'react'
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import * as Haptics from 'expo-haptics'
import { ThemeColors, BorderRadius, FontSize, Spacing, withAlpha } from '@/constants/theme'
import { useTheme } from '@/stores/appStore'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSubtle'
type Size = 'lg' | 'md'

interface AccessibleButtonProps {
  label:     string
  onPress:   () => void
  variant?:  Variant
  size?:     Size
  icon?:     keyof typeof Ionicons.glyphMap
  disabled?: boolean
  loading?:  boolean
  hint?:     string
  style?:    StyleProp<ViewStyle>
}

// Bouton accessible réutilisable : rôle + label + état (disabled/busy) + haptique.
// Variantes (primary/secondary/ghost/danger/dangerSubtle), tailles (lg=52 / md=44),
// icône optionnelle, état loading. Source unique de vérité des boutons de l'app.
export default function AccessibleButton({
  label, onPress, variant = 'primary', size = 'lg',
  icon, disabled = false, loading = false, hint, style,
}: AccessibleButtonProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const isDisabled = disabled || loading
  // Couleur du texte/icône selon la variante (le spinner suit la même).
  const fg =
    variant === 'primary'      ? C.white :
    variant === 'danger'       ? C.white :
    variant === 'secondary'    ? C.primary3 :
    variant === 'dangerSubtle' ? C.danger :
    /* ghost */                  C.text2
  const iconSize = size === 'md' ? 16 : 18
  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
        onPress()
      }}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[s.btn, s[`size_${size}`], s[variant], isDisabled && s.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={s.content}>
          {icon && <Ionicons name={icon} size={iconSize} color={fg} />}
          <Text style={[s.text, { color: fg }]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  btn: {
    borderRadius: BorderRadius.lg, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl,
  },
  size_lg: { height: 52 },
  size_md: { height: 44 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  primary:      { backgroundColor: C.primary },
  danger:       { backgroundColor: C.danger },
  secondary:    { backgroundColor: withAlpha(C.primary, 0.12), borderWidth: 1, borderColor: withAlpha(C.primary, 0.3) },
  ghost:        { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  dangerSubtle: { backgroundColor: withAlpha(C.danger, 0.1), borderWidth: 1, borderColor: withAlpha(C.danger, 0.25) },
  disabled: { opacity: 0.5 },
  text: { fontSize: FontSize.md, fontFamily: 'Geist_800ExtraBold' },
})
