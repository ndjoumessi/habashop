import { Component, useMemo, type ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import * as Updates from 'expo-updates'
import { useI18n, useTheme } from '@/stores/appStore'
import { ThemeColors, Spacing, BorderRadius, FontSize } from '@/constants/theme'
import { logger } from '@/lib/logger'

// Écran de secours plein écran : remplace le « white screen » qui survenait
// quand un composant levait une erreur en plein encaissement. Traduit + thémé.
function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { C } = useTheme()
  const s = useMemo(() => makeStyles(C), [C])
  const { i } = useI18n()

  const restart = () => {
    // En build (OTA), recharge le bundle JS proprement ; sinon on retombe sur le reset.
    Updates.reloadAsync().catch((e) => {
      logger.warn('Updates.reloadAsync échoué, reset local:', e)
      onReset()
    })
  }

  return (
    <View style={s.wrap}>
      <Text style={s.emoji}>😕</Text>
      <Text style={s.title}>
        {i('Oups, une erreur est survenue', 'Oops, something went wrong', 'Vaya, algo salió mal', 'Ops, qualcosa è andato storto')}
      </Text>
      <Text style={s.desc}>
        {i(
          "Réessaie, ou redémarre l'application. Les ventes déjà enregistrées ne sont pas perdues.",
          'Try again, or restart the app. Sales already recorded are not lost.',
          'Inténtalo de nuevo o reinicia la app. Las ventas ya registradas no se pierden.',
          "Riprova o riavvia l'app. Le vendite già registrate non vanno perse.",
        )}
      </Text>

      {__DEV__ && error?.message ? (
        <ScrollView style={s.devBox} contentContainerStyle={s.devInner}>
          <Text style={s.devTxt}>{error.message}</Text>
        </ScrollView>
      ) : null}

      <Pressable style={s.btnPrimary} onPress={onReset}
        accessibilityRole="button"
        accessibilityLabel={i('Réessayer', 'Try again', 'Reintentar', 'Riprova')}>
        <Text style={s.btnPrimaryTxt}>{i('Réessayer', 'Try again', 'Reintentar', 'Riprova')}</Text>
      </Pressable>
      <Pressable style={s.btnGhost} onPress={restart}
        accessibilityRole="button"
        accessibilityLabel={i("Redémarrer l'application", 'Restart the app', 'Reiniciar la app', "Riavvia l'app")}>
        <Text style={s.btnGhostTxt}>
          {i("Redémarrer l'application", 'Restart the app', 'Reiniciar la app', "Riavvia l'app")}
        </Text>
      </Pressable>
    </View>
  )
}

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // warn/error restent actifs en prod → seront captés par un crash reporter (Sentry) si branché.
    logger.error('ErrorBoundary a capté une erreur:', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) return <ErrorFallback error={this.state.error} onReset={this.reset} />
    return this.props.children
  }
}

const makeStyles = (C: ThemeColors) => StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  emoji: { fontSize: 56, marginBottom: Spacing.xl },
  title: { fontSize: FontSize.xl, fontFamily: 'Outfit_800ExtraBold', color: C.text, textAlign: 'center', marginBottom: Spacing.md },
  desc: { fontSize: FontSize.md, fontFamily: 'Outfit_400Regular', color: C.text3, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xxl },
  devBox: { maxHeight: 120, alignSelf: 'stretch', backgroundColor: C.card, borderRadius: BorderRadius.md, marginBottom: Spacing.xl },
  devInner: { padding: Spacing.md },
  devTxt: { fontSize: FontSize.xs, fontFamily: 'JetBrainsMono_400Regular', color: C.danger },
  btnPrimary: { alignSelf: 'stretch', backgroundColor: C.primary, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center', marginBottom: Spacing.md },
  btnPrimaryTxt: { color: C.white, fontSize: FontSize.md, fontFamily: 'Outfit_800ExtraBold' },
  btnGhost: { alignSelf: 'stretch', paddingVertical: Spacing.md, alignItems: 'center' },
  btnGhostTxt: { color: C.text3, fontSize: FontSize.md, fontFamily: 'Outfit_600SemiBold' },
})
