import { logger } from '@/lib/logger'
import { useEffect } from 'react'
import { Stack, router, type Href } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { asyncStoragePersister, shouldDehydrateQuery, PERSIST_MAX_AGE } from '@/services/queryPersist'
import SyncToast from '@/components/ui/SyncToast'
import FailedSalesBanner from '@/components/ui/FailedSalesBanner'
// Imports subpath (pas le barrel) : le barrel `@expo-google-fonts/*` fait bundler
// par Metro TOUTES les graisses (.ttf) du package — ~2 MB de polices mortes.
import { useFonts } from '@expo-google-fonts/geist/useFonts'
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular'
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold'
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold'
import { Geist_800ExtraBold } from '@expo-google-fonts/geist/800ExtraBold'
import { Geist_900Black } from '@expo-google-fonts/geist/900Black'
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono/400Regular'
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold'
import * as SplashScreen from 'expo-splash-screen'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/stores/appStore'
import { registerForPushNotifications } from '@/services/notifications'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { initCrashReporter } from '@/lib/crashReporter'
import { setupWidgetChannel, isWidgetEnabled } from '@/services/widgetNotification'
import { registerWidgetRefresh } from '@/tasks/backgroundRefresh'

SplashScreen.preventAutoHideAsync()
// gcTime 24 h (≥ PERSIST_MAX_AGE) : les requêtes restaurées depuis AsyncStorage doivent
// survivre en mémoire au lieu d'être garbage-collectées aussitôt (5 min par défaut), sinon
// la consultation offline à froid n'aurait rien à afficher.
const qc = new QueryClient({
  defaultOptions:{ queries:{ staleTime:5*60*1000, gcTime:PERSIST_MAX_AGE, retry:2 } }
})

// Doit vivre SOUS le provider Query (useOfflineSync utilise useQueryClient). Rend aussi le
// toast « X vente(s) synchronisée(s) » piloté par le signal de resync de la file offline.
function OfflineSyncBridge() {
  const { lastSync, failedCount } = useOfflineSync() // sync auto de la file offline au retour réseau
  return (
    <>
      <SyncToast signal={lastSync} />
      {/* Ventes encaissées jamais enregistrées : bandeau DURABLE (pas un toast) —
          `failedCount` sert de clé de rafraîchissement après chaque cycle de sync. */}
      <FailedSalesBanner refreshKey={failedCount} />
    </>
  )
}

export default function RootLayout() {
  const restoreSession = useAuthStore(s=>s.restoreSession)
  const { isDark } = useTheme()
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular, Geist_600SemiBold,
    Geist_700Bold, Geist_800ExtraBold, Geist_900Black,
    JetBrainsMono_400Regular, JetBrainsMono_700Bold,
  })

  useEffect(() => { restoreSession() }, [])
  // Crash reporter (Sentry) — no-op en Expo Go / sans DSN (cf. crashReporter.ts).
  useEffect(() => { initCrashReporter() }, [])
  // Widget CA (opt-in) : crée le canal Android + (ré)enregistre le refresh de fond si activé.
  useEffect(() => {
    const init = async () => {
      await setupWidgetChannel()
      if (await isWidgetEnabled()) await registerWidgetRefresh()
    }
    init().catch(() => {})
  }, [])
  // Cacher le splash dès que les fonts sont prêtes OU en erreur — sinon une
  // police qui échoue au chargement fige l'app sur le splash indéfiniment.
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync()
  }, [fontsLoaded, fontError])

  // ── Notifications push ──
  useEffect(() => {
    registerForPushNotifications()

    const sub1 = Notifications.addNotificationReceivedListener(notification => {
      logger.log('Notif reçue:', notification)
    })
    const sub2 = Notifications.addNotificationResponseReceivedListener(response => {
      // Tap sur une notif → navigue vers l'écran pertinent (route explicite ou par type).
      const data = response.notification.request.content.data as { route?: string; type?: string }
      if (data?.route) {
        // route arbitraire issue du payload de notif → typée Href pour expo-router.
        router.push(data.route as Href)
      } else if (data?.type === 'low_stock') {
        router.push('/(app)/(tabs)/stock')
      } else if (data?.type === 'trial_expiring') {
        router.push('/(app)/(tabs)/settings')
      } else if (
        data?.type === 'new_sale' ||
        data?.type === 'widget' ||
        data?.type === 'payment_received' ||
        // Pas d'écran RH sur mobile → un congé en attente ouvre le dashboard par défaut.
        data?.type === 'leave_pending'
      ) {
        router.push('/(app)/(tabs)/dashboard')
      }
    })

    return () => { sub1.remove(); sub2.remove() }
  }, [])

  if (!fontsLoaded && !fontError) return null

  return (
    <GestureHandlerRootView style={{flex:1}}>
      <ErrorBoundary>
        <PersistQueryClientProvider
          client={qc}
          persistOptions={{
            persister: asyncStoragePersister,
            maxAge: PERSIST_MAX_AGE,
            dehydrateOptions: { shouldDehydrateQuery },
          }}
        >
          <StatusBar style={isDark ? 'light' : 'dark'}/>
          <OfflineSyncBridge/>
          <Stack screenOptions={{headerShown:false}}>
            <Stack.Screen name="(auth)"/>
            <Stack.Screen name="(app)"/>
          </Stack>
        </PersistQueryClientProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
