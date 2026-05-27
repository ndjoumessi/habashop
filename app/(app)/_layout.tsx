import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'
import { Colors } from '@/constants/theme'

export default function AppLayout() {
  const { isLoggedIn, isLoading } = useAuthStore()
  if (!isLoading && !isLoggedIn)
    return <Redirect href="/(auth)/login"/>
  return (
    <Stack screenOptions={{
      headerShown:false,
      contentStyle:{backgroundColor:Colors.bg}
    }}>
      <Stack.Screen name="(tabs)"/>
      <Stack.Screen name="pos/index"
        options={{presentation:'fullScreenModal'}}/>
      <Stack.Screen name="reports/index"/>
      <Stack.Screen name="sales/index"/>
      <Stack.Screen name="search/index"/>
    </Stack>
  )
}
