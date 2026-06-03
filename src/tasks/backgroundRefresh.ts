import { logger } from '@/lib/logger'
import * as TaskManager from 'expo-task-manager'
import * as BackgroundTask from 'expo-background-task'
import { refreshWidget } from '@/services/widgetNotification'

// expo-background-task (remplace expo-background-fetch déprécié). Best effort sur
// Android (≥ 15 min, non garanti) ; ne tourne pas pendant que l'app est tuée en
// Expo Go mais le module est dispo en Expo Go (l'import ne casse rien).
// ⚠️ minimumInterval est en MINUTES ici (était en secondes avec background-fetch).
const TASK_NAME = 'HABASHOP_WIDGET_REFRESH'

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    // fmt simplifié (FCFA) côté background — pas d'accès au store i18n ici.
    const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`
    await refreshWidget(fmt, 'fr')
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
