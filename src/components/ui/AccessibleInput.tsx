import { useMemo } from 'react'
import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native'
import { ThemeColors, BorderRadius, FontSize, Spacing } from '@/constants/theme'
import { useTheme } from '@/stores/appStore'

interface AccessibleInputProps extends TextInputProps {
  label:  string
  hint?:  string
  error?: string
}

// Champ accessible : <label> visible + accessibilityLabel/Hint + message d'erreur annoncé.
// Pour les futurs formulaires étiquetés (le label fournit le nom accessible du champ).
export default function AccessibleInput({
  label, hint, error, style, ...props
}: AccessibleInputProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={C.text3}
        style={[s.input, error ? s.inputError : null, style]}
      />
      {error
        ? <Text style={s.error} accessibilityRole="alert">⚠ {error}</Text>
        : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  wrap: { gap: Spacing.xs },
  label: {
    fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: C.text3,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: C.bg3, borderWidth: 1, borderColor: C.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48,
    fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text,
  },
  inputError: { borderColor: C.danger },
  hint:  { fontSize: FontSize.xs, color: C.text3, fontFamily: 'Outfit_400Regular' },
  error: { fontSize: FontSize.xs, color: C.danger, fontFamily: 'Outfit_700Bold' },
})
