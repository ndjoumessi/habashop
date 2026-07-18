import { logger } from '@/lib/logger'
import * as TaskManager from 'expo-task-manager'
import * as BackgroundTask from 'expo-background-task'
import { refreshWidget } from '@/services/widgetNotification'
import { useAppStore, whenAppStoreHydrated, formatAmount } from '@/stores/appStore'

// expo-background-task (remplace expo-background-fetch déprécié). Best effort sur
// Android (≥ 15 min, non garanti) ; ne tourne pas pendant que l'app est tuée en
// Expo Go mais le module est dispo en Expo Go (l'import ne casse rien).
// ⚠️ minimumInterval est en MINUTES ici (était en secondes avec background-fetch).
const TASK_NAME = 'HABASHOP_WIDGET_REFRESH'

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    // Devise + langue lues depuis le store persisté (hydraté) → widget cohérent avec
    // le tenant : plus de « F » ni de « fr » figés. formatAmount = même logique que
    // les écrans (symbole/décimales/conversion via cachedRates).
    await whenAppStoreHydrated()
    const { currency, lang } = useAppStore.getState()
    const fmt = (n: number) => formatAmount(n, currency)
    await refreshWidget(fmt, lang)
    return BackgroundTask.BackgroundTaskResult.Success
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

export async function registerWidgetRefresh(): Promise<void> {
  try {
    await BackgroundTask.registerTaskAsync(TASK_NAME, {
      minimumInterval: 15, // minutes (minimum imposé par le système)
    })
  } catch (err) {
    logger.error('Background task register error:', err)
  }
}

export async function unregisterWidgetRefresh(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(TASK_NAME)
  } catch (e) {
    logger.warn('Désinscription du refresh widget échouée:', e)
  }
}
