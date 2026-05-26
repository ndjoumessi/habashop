import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'
import { Colors } from '@/constants/theme'

export default function AuthLayout() {
  const { isLoggedIn, isLoading } = useAuthStore()
  if (!isLoading && isLoggedIn)
    return <Redirect href="/(app)/(tabs)/dashboard"/>
  return (
    <Stack screenOptions={{
      headerShown:false,
      contentStyle:{backgroundColor:Colors.bg}
    }}>
      <Stack.Screen name="login"/>
    </Stack>
  )
}
