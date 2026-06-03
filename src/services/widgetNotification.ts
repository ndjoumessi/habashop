import { logger } from '@/lib/logger'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { analyticsApi } from './api'
import { Colors } from '@/constants/theme'

// "Widget" = notification persistante (Android) simulant un widget de CA du jour.
// ⚠️ Pas un vrai widget natif (nécessiterait du Kotlin). Le rafraîchissement en
// arrière-plan nécessite un dev build (ne tourne pas dans Expo Go).
const WIDGET_CHANNEL     = 'habashop-widget'
const WIDGET_NOTIF_ID    = 'habashop-ca-widget'
const WIDGET_ENABLED_KEY = 'habashop_widget_enabled'

// Opt-in persisté : le widget ne s'affiche que si l'utilisateur l'active (Réglages).
export async function isWidgetEnabled(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(WIDGET_ENABLED_KEY)) === 'true' } catch { return false }
}
export async function setWidgetEnabled(value: boolean): Promise<void> {
  try { await AsyncStorage.setItem(WIDGET_ENABLED_KEY, value ? 'true' : 'false') } catch (e) { logger.warn('Écriture flag widget échouée:', e) }
}

// Canal Android dédié (importance basse : pas de son/vibration).
export async function setupWidgetChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(WIDGET_CHANNEL, {
    name: 'Widget CA du jour',
    importance: Notifications.AndroidImportance.LOW,
    showBadge: false,
    enableVibrate: false,
    sound: null,
  })
}

export async function dismissWidget(): Promise<void> {
  await Notifications.dismissNotificationAsync(WIDGET_NOTIF_ID).catch(() => {})
}

// Met à jour la notification persistante avec le CA du jour.
export async function updateWidgetNotification(
  salesToday: number,
  transactionsToday: number,
  fmt: (n: number) => string,
  lang: string,
): Promise<void> {
  try {
    await dismissWidget()
    const title =
      lang === 'en' ? `💰 Today: ${fmt(salesToday)}`
      : lang === 'es' ? `💰 Hoy: ${fmt(salesToday)}`
      : lang === 'it' ? `💰 Oggi: ${fmt(salesToday)}`
      : `💰 Aujourd'hui: ${fmt(salesToday)}`
    const body =
      lang === 'en' ? `${transactionsToday} sales`
      : lang === 'es' ? `${transactionsToday} ventas`
      : lang === 'it' ? `${transactionsToday} vendite`
      : `${transactionsToday} ventes`

    await Notifications.scheduleNotificationAsync({
      identifier: WIDGET_NOTIF_ID,
      content: {
        title,
        body,
        sticky: true,        // persistante (Android)
        autoDismiss: false,
        color: Colors.primary,
        data: { type: 'widget', route: '/(app)/(tabs)/dashboard' },
      },
      trigger: null,
    })
  } catch (err) {
    logger.error('Widget update error:', err)
  }
}

// Rafraîchit le widget depuis l'API (no-op si désactivé).
export async function refreshWidget(fmt: (n: number) => string, lang: string): Promise<void> {
  try {
    if (!(await isWidgetEnabled())) return
    const data = await analyticsApi.dashboard()
    await updateWidgetNotification(data.salesToday ?? 0, data.transactionsToday ?? 0, fmt, lang)
  } catch (e) {
    logger.warn('Rafraîchissement du widget échoué:', e)
  }
}
