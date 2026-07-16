import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/stores/appStore'

export default function AppLayout() {
  const { isLoggedIn, isLoading } = useAuthStore()
  const { C } = useTheme()
  if (!isLoading && !isLoggedIn)
    return <Redirect href="/(auth)/login"/>
  return (
    <Stack screenOptions={{
      headerShown:false,
      contentStyle:{backgroundColor:C.bg}
    }}>
      <Stack.Screen name="(tabs)"/>
      <Stack.Screen name="pos/index"
        options={{presentation:'fullScreenModal'}}/>
      <Stack.Screen name="kiosk/index"
        options={{headerShown:false, presentation:'fullScreenModal', animation:'fade'}}/>
      <Stack.Screen name="reports/index"/>
      <Stack.Screen name="sales/index"/>
      <Stack.Screen name="search/index"/>
      <Stack.Screen name="delete-account"/>
    </Stack>
  )
}
