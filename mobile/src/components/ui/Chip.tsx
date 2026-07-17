import { useMemo } from 'react'
import { Text, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize } from '@/constants/theme'

interface ChipProps {
  label:               string
  selected:            boolean
  onPress:             () => void
  accessibilityLabel?: string
}

// Pastille de filtre réutilisable (catégories POS, périodes Rapports/Historique).
// Hauteur ≥ 44 (cible tactile), état sélectionné = primaire plein.
export default function Chip({ label, selected, onPress, accessibilityLabel }: ChipProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, selected && s.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[s.txt, selected && s.txtOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  chip: {
    minHeight: 44, justifyContent: 'center', maxWidth: 200,
    paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full,
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
  },
  chipOn: { backgroundColor: C.primary, borderColor: C.primary },
  txt: { fontSize: FontSize.xs, fontFamily: 'Outfit_600SemiBold', color: C.text2 },
  txtOn: { color: C.white },
})
