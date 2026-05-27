import AsyncStorage from '@react-native-async-storage/async-storage'
import { disableBiometric } from './biometric'
import { usePosStore } from '@/stores/posStore'

/**
 * Données AsyncStorage LIÉES AU COMPTE à effacer à la suppression.
 * ⚠️ On NE touche PAS aux préférences device (langue / thème / devise / kiosque)
 *    persistées par appStore — décidé avec Nelson (prefs ≠ PII du compte).
 */
const ACCOUNT_KEYS = [
  'habashop_profile_photo',   // photo de profil (useProfilePhoto)
  'habashop_offline_queue',   // file d'actions offline (offlineQueue)
  'habashop_widget_enabled',  // flag widget CA (widgetNotification)
]

/**
 * Efface toutes les données locales liées au compte après une suppression réussie.
 * (Le token JWT est retiré par authStore.logout() ; le cache TanStack Query est
 *  vidé par l'écran via queryClient.clear() ; la redirection vient du guard d'auth.)
 */
export async function purgeLocalAccountData(): Promise<void> {
  try { await disableBiometric() } catch { /* SecureStore biométrie — non bloquant */ }
  try { await AsyncStorage.multiRemove(ACCOUNT_KEYS) } catch { /* non bloquant */ }
  try { usePosStore.getState().clearCart() } catch { /* panier — non bloquant */ }
}
