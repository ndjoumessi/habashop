import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '@/stores/authStore'
import { Colors } from '@/constants/theme'

// Route racine '/'. Sans elle, un build preview/prod ouvre sur un écran noir :
// la sitemap qui « sauve » la racine non matchée en dev est retirée du bundle release.
// On attend la fin de restoreSession (isLoading) puis on redirige selon l'auth.
export default function Index() {
  const { isLoggedIn, isLoading } = useAuthStore()

  if (isLoading)
    return (
      <View style={{ flex:1, backgroundColor:Colors.bg, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator color={Colors.primary}/>
      </View>
    )

  return <Redirect href={isLoggedIn ? '/(app)/(tabs)/dashboard' : '/(auth)/login'}/>
}
