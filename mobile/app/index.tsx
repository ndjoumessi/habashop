import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/stores/appStore'

// Route racine '/'. Sans elle, un build preview/prod ouvre sur un écran noir :
// la sitemap qui « sauve » la racine non matchée en dev est retirée du bundle release.
// On attend la fin de restoreSession (isLoading) puis on redirige selon l'auth.
export default function Index() {
  const { C } = useTheme()
  const { isLoggedIn, isLoading } = useAuthStore()

  if (isLoading)
    return (
      <View style={{ flex:1, backgroundColor:C.bg, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator color={C.primary}/>
      </View>
    )

  return <Redirect href={isLoggedIn ? '/(app)/(tabs)/dashboard' : '/(auth)/login'}/>
}
