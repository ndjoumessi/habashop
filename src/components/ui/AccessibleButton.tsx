import { useMemo } from 'react'
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { ThemeColors, BorderRadius, FontSize } from '@/constants/theme'
import { useTheme } from '@/stores/appStore'

interface AccessibleButtonProps {
  label:     string
  onPress:   () => void
  variant?:  'primary' | 'ghost' | 'danger'
  disabled?: boolean
  loading?:  boolean
  hint?:     string
}

// Bouton accessible réutilisable : rôle + label + état (disabled/busy) + haptique.
// Supporte un état `loading` (spinner) car les boutons async de l'app en ont besoin.
export default function AccessibleButton({
  label, onPress, variant = 'primary', disabled = false, loading = false, hint,
}: AccessibleButtonProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const isDisabled = disabled || loading
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
      style={[s.btn, s[variant], isDisabled && s.disabled]}
    >
      {loading
        ? <ActivityIndicator color={variant === 'ghost' ? C.text2 : C.white} size="small" />
        : <Text style={[s.text, variant === 'ghost' ? s.textGhost : s.textOn]}>{label}</Text>}
    </TouchableOpacity>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  btn: {
    height: 52, borderRadius: BorderRadius.lg, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  primary: { backgroundColor: C.primary },
  ghost:   { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  danger:  { backgroundColor: C.danger },
  disabled: { opacity: 0.5 },
  text:      { fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold' },
  textOn:    { color: C.white },
  textGhost: { color: C.text2 },
})
