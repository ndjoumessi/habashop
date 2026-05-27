import { View, Text, TextInput, StyleSheet, type TextInputProps } from 'react-native'
import { Colors, BorderRadius, FontSize, Spacing } from '@/constants/theme'

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
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={Colors.text3}
        style={[s.input, error ? s.inputError : null, style]}
      />
      {error
        ? <Text style={s.error} accessibilityRole="alert">⚠ {error}</Text>
        : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  label: {
    fontSize: FontSize.xs, fontFamily: 'Outfit_700Bold', color: Colors.text3,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.bg3, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 48,
    fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: Colors.text,
  },
  inputError: { borderColor: Colors.danger },
  hint:  { fontSize: 11, color: Colors.text3, fontFamily: 'Outfit_400Regular' },
  error: { fontSize: 11, color: Colors.danger, fontFamily: 'Outfit_700Bold' },
})
