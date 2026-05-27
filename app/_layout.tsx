import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useFonts,
  Outfit_400Regular, Outfit_600SemiBold,
  Outfit_700Bold, Outfit_800ExtraBold, Outfit_900Black,
} from '@expo-google-fonts/outfit'
import {
  JetBrainsMono_400Regular, JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono'
import * as SplashScreen from 'expo-splash-screen'
import { useAuthStore } from '@/stores/authStore'
import { registerForPushNotifications } from '@/services/notifications'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { setupWidgetChannel, isWidgetEnabled } from '@/services/widgetNotification'
import { registerWidgetRefresh } from '@/tasks/backgroundRefresh'

SplashScreen.preventAutoHideAsync()
const qc = new QueryClient({
  defaultOptions:{ queries:{ staleTime:5*60*1000, retry:2 } }
})

// Doit vivre SOUS le QueryClientProvider (useOfflineSync utilise useQueryClient).
function OfflineSyncBridge() {
  useOfflineSync() // sync auto de la file offline au retour réseau
  return null
}

export default function RootLayout() {
  const restoreSession = useAuthStore(s=>s.restoreSession)
  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular, Outfit_600SemiBold,
    Outfit_700Bold, Outfit_800ExtraBold, Outfit_900Black,
    JetBrainsMono_400Regular, JetBrainsMono_700Bold,
  })

  useEffect(() => { restoreSession() }, [])
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
      console.log('Notif reçue:', notification)
    })
    const sub2 = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any
      if (data?.route) router.push(data.route)
    })

    return () => { sub1.remove(); sub2.remove() }
  }, [])

  if (!fontsLoaded && !fontError) return null

  return (
    <GestureHandlerRootView style={{flex:1}}>
      <QueryClientProvider client={qc}>
        <StatusBar style="light"/>
        <OfflineSyncBridge/>
        <Stack screenOptions={{headerShown:false}}>
          <Stack.Screen name="(auth)"/>
          <Stack.Screen name="(app)"/>
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
