import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { apiClient } from './api'

// Configuration globale (expo-notifications SDK 54 : shouldShowBanner/List requis)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true, // legacy (déprécié mais accepté)
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
})

// Enregistrement du token push
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push: simulateur ignoré')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    console.log('Push: permission refusée')
    return null
  }

  try {
    // projectId EAS (écrit dans app.json extra.eas.projectId par `eas init`).
    // Requis pour obtenir un token push Expo dans un dev/production build.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const token = (await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    )).data

    // Envoi du token au backend (route à ajouter côté backend — fail-safe)
    await apiClient.post('/api/notifications/token', {
      token,
      platform: Platform.OS,
      deviceId: Device.modelName ?? 'unknown',
    }).catch(() => {})

    // Canal Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'HabaShop',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6C47FF',
      })
    }

    return token
  } catch (err) {
    console.log('Push token error:', err)
    return null
  }
}

// Notification locale (test immédiat)
export async function sendLocalNotification(opts: {
  title: string
  body: string
  data?: Record<string, unknown>
}): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      data: opts.data ?? {},
      sound: true,
    },
    trigger: null, // immédiat
  })
}
