import { useEffect, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { router, type ErrorBoundaryProps } from 'expo-router'
import { useI18n, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize } from '@/constants/theme'
import { logger } from '@/lib/logger'
import { captureException } from '@/lib/crashReporter'

/**
 * Fallback LOCALISÉ d'erreur de route — branché via la convention Expo Router
 * `export { ErrorBoundary }` dans un layout/écran. Un écran qui plante affiche ce
 * panneau SANS tuer la navigation globale ni les autres écrans (≠ boundary racine).
 * Le crash est remonté à Sentry (crashReporter). « Réessayer » re-rend l'écran,
 * « Retour » en sort proprement.
 */
export default function RouteErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()

  useEffect(() => {
    logger.error('Route ErrorBoundary a capté une erreur:', error)
    captureException(error, { scope: 'route-boundary' })
  }, [error])

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/(app)/(tabs)/dashboard')
  }

  return (
    <View style={s.wrap}>
      <Text style={s.emoji}>😕</Text>
      <Text style={s.title}>
        {i('Cet écran a rencontré un problème', 'This screen ran into a problem', 'Esta pantalla tuvo un problema', 'Questa schermata ha avuto un problema')}
      </Text>
      <Text style={s.desc}>
        {i(
          'Tu peux réessayer ou revenir en arrière. Le reste de l’app fonctionne normalement.',
          'You can retry or go back. The rest of the app keeps working.',
          'Puedes reintentar o volver. El resto de la app sigue funcionando.',
          'Puoi riprovare o tornare indietro. Il resto dell’app funziona normalmente.',
        )}
      </Text>

      {__DEV__ && error?.message ? (
        <ScrollView style={s.devBox} contentContainerStyle={s.devInner}>
          <Text style={s.devTxt}>{error.message}</Text>
        </ScrollView>
      ) : null}

      <Pressable style={s.btnPrimary} onPress={() => retry()}
        accessibilityRole="button" accessibilityLabel={i('Réessayer', 'Try again', 'Reintentar', 'Riprova')}>
        <Text style={s.btnPrimaryTxt}>{i('Réessayer', 'Try again', 'Reintentar', 'Riprova')}</Text>
      </Pressable>
      <Pressable style={s.btnGhost} onPress={goBack}
        accessibilityRole="button" accessibilityLabel={i('Retour', 'Go back', 'Volver', 'Indietro')}>
        <Text style={s.btnGhostTxt}>{i('Retour', 'Go back', 'Volver', 'Indietro')}</Text>
      </Pressable>
    </View>
  )
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  emoji: { fontSize: 56, marginBottom: Spacing.xl },
  title: { fontSize: FontSize.xl, fontFamily: 'Geist_800ExtraBold', color: C.text, textAlign: 'center', marginBottom: Spacing.md },
  desc: { fontSize: FontSize.md, fontFamily: 'Geist_400Regular', color: C.text3, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xxl },
  devBox: { maxHeight: 120, alignSelf: 'stretch', backgroundColor: C.card, borderRadius: BorderRadius.md, marginBottom: Spacing.xl },
  devInner: { padding: Spacing.md },
  devTxt: { fontSize: FontSize.xs, fontFamily: 'JetBrainsMono_400Regular', color: C.danger },
  btnPrimary: { alignSelf: 'stretch', backgroundColor: C.primary, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center', marginBottom: Spacing.md },
  btnPrimaryTxt: { color: C.white, fontSize: FontSize.md, fontFamily: 'Geist_800ExtraBold' },
  btnGhost: { alignSelf: 'stretch', paddingVertical: Spacing.md, alignItems: 'center' },
  btnGhostTxt: { color: C.text3, fontSize: FontSize.md, fontFamily: 'Geist_600SemiBold' },
})
