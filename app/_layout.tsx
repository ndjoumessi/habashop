import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
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

SplashScreen.preventAutoHideAsync()
const qc = new QueryClient({
  defaultOptions:{ queries:{ staleTime:5*60*1000, retry:2 } }
})

export default function RootLayout() {
  const restoreSession = useAuthStore(s=>s.restoreSession)
  const [fontsLoaded] = useFonts({
    Outfit_400Regular, Outfit_600SemiBold,
    Outfit_700Bold, Outfit_800ExtraBold, Outfit_900Black,
    JetBrainsMono_400Regular, JetBrainsMono_700Bold,
  })

  useEffect(() => { restoreSession() }, [])
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{flex:1}}>
      <QueryClientProvider client={qc}>
        <StatusBar style="light"/>
        <Stack screenOptions={{headerShown:false}}>
          <Stack.Screen name="(auth)"/>
          <Stack.Screen name="(app)"/>
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
