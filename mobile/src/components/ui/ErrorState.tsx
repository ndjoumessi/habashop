import { useMemo } from 'react'
import { Text, Pressable, StyleSheet } from 'react-native'
import { useI18n, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, FontSize } from '@/constants/theme'

interface ErrorStateProps {
  onRetry?: () => void
  message?: string
}

// État d'erreur standardisé + retry accessible. Remplace les blocs « ⚠️ Erreur — toucher
// pour réessayer » dupliqués dans POS / stock / customers / reports.
export default function ErrorState({ onRetry, message }: ErrorStateProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()
  const label = message ?? i(
    'Erreur — toucher pour réessayer',
    'Error — tap to retry',
    'Error — toca para reintentar',
    'Errore — tocca per riprovare',
  )
  return (
    <Pressable
      style={s.wrap}
      onPress={onRetry}
      disabled={!onRetry}
      accessibilityRole={onRetry ? 'button' : undefined}
      accessibilityLabel={label}
    >
      <Text style={s.txt}>⚠️ {label}</Text>
    </Pressable>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  txt: { fontSize: FontSize.sm, fontFamily: 'Outfit_600SemiBold', color: C.danger, textAlign: 'center' },
})
