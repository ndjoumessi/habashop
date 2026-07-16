import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/stores/appStore'

export default function AuthLayout() {
  const { C } = useTheme()
  const { isLoggedIn, isLoading } = useAuthStore()
  if (!isLoading && isLoggedIn)
    return <Redirect href="/(app)/(tabs)/dashboard"/>
  return (
    <Stack screenOptions={{
      headerShown:false,
      contentStyle:{backgroundColor:C.bg}
    }}>
      <Stack.Screen name="login"/>
    </Stack>
  )
}
