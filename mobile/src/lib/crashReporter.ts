import Constants, { ExecutionEnvironment } from 'expo-constants'
import { logger } from '@/lib/logger'

// Crash reporter (Sentry) — activé UNIQUEMENT :
//  • hors Expo Go (le module natif Sentry n'y existe pas → StoreClient exclu), ET
//  • si un DSN est fourni via EXPO_PUBLIC_SENTRY_DSN.
// L'import de '@sentry/react-native' est DYNAMIQUE : en Expo Go il n'est jamais
// évalué, donc zéro risque pour le test en Expo Go. Inerte tant qu'aucun DSN.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN
const isActive = !!DSN && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient

type SentryModule = typeof import('@sentry/react-native')
let sentry: SentryModule | null = null

export async function initCrashReporter(): Promise<void> {
  if (!isActive) {
    logger.log('[crashReporter] inactif (Expo Go ou DSN absent).')
    return
  }
  try {
    sentry = await import('@sentry/react-native')
    sentry.init({
      dsn: DSN,
      // Échantillonnage conservateur ; pas de Replay/profiling (config native en plus).
      tracesSampleRate: 0.2,
    })
    logger.log('[crashReporter] Sentry initialisé.')
  } catch (e) {
    logger.warn('[crashReporter] init Sentry échouée:', e)
  }
}

// Remonte une exception capturée (ex. depuis l'Error Boundary). No-op si inactif.
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!sentry) return
  try {
    sentry.captureException(error, context ? { extra: context } : undefined)
  } catch (e) {
    logger.warn('[crashReporter] captureException échouée:', e)
  }
}
