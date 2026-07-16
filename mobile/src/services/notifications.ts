import { logger } from '@/lib/logger'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { apiClient } from './api'

const PUSH_TOKEN_KEY = 'push_token'

export async function getStoredPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(PUSH_TOKEN_KEY).catch(() => null)
}

export async function clearStoredPushToken(): Promise<void> {
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY).catch(() => {})
}

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

// Enregistrement du token push (dev/production build uniquement — retiré
// d'Expo Go depuis le SDK 53). Renvoie le token Expo ou null.
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    logger.log('📱 Push: appareil réel requis (simulateur ignoré)')
    return null
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    logger.log('🔔 Push: permission refusée')
    return null
  }

  try {
    // projectId EAS (écrit dans app.json extra.eas.projectId par `eas init`).
    // Requis pour obtenir un token push Expo dans un dev/production build.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    if (!projectId) {
      logger.warn('⚠️  Push: projectId EAS manquant (app.json extra.eas.projectId)')
      return null
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
    logger.log('✅ Push token:', token)
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token).catch(() => {})

    // Canal Android (avant l'enregistrement backend — affecte le rendu local)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'HabaShop',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6C47FF',
        sound: 'default',
      })
    }

    // Envoi du token au backend (upsert idempotent par token — fail-safe)
    try {
      const res = await apiClient.post('/api/notifications/token', {
        token,
        platform:   Platform.OS,
        deviceId:   Device.modelName ?? Device.deviceName ?? 'unknown',
        appVersion: Constants.expoConfig?.version ?? '1.0.0',
      })
      logger.log('✅ Token enregistré (Railway):', res.data)
    } catch (e) {
      logger.warn('⚠️  Push: échec enregistrement backend (réessai au prochain démarrage)')
    }

    return token
  } catch (err) {
    logger.error('❌ Push token error:', err)
    return null
  }
}

// Notification locale de test (immédiate) — vérifie que le rendu fonctionne
// sans dépendre du backend ni d'un token distant.
export async function testPushNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🛍️ HabaShop',
      body:  'Notifications fonctionnelles ✅',
      data:  { type: 'test' },
      sound: true,
    },
    trigger: null, // immédiat
  })
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
