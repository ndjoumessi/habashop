import { logger } from '@/lib/logger'
import * as TaskManager from 'expo-task-manager'
import * as BackgroundFetch from 'expo-background-fetch'
import { refreshWidget } from '@/services/widgetNotification'

// ⚠️ expo-background-fetch est déprécié en SDK 54 (recommandé : expo-background-task).
// registerTaskAsync() fonctionne encore. Le background fetch nécessite un dev build
// (pas Expo Go) et reste « best effort » sur Android (≥ 15 min, non garanti).
const TASK_NAME = 'HABASHOP_WIDGET_REFRESH'

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    // fmt simplifié (FCFA) côté background — pas d'accès au store i18n ici.
    const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`
    await refreshWidget(fmt, 'fr')
    return BackgroundFetch.BackgroundFetchResult.NewData
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed
  }
})

export async function registerWidgetRefresh(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: 15 * 60, // 15 min
      stopOnTerminate: false,
      startOnBoot: true,
    })
  } catch (err) {
    logger.error('Background fetch register error:', err)
  }
}

export async function unregisterWidgetRefresh(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(TASK_NAME)
  } catch {}
}
