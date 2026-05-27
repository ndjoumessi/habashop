import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'

const BIOMETRIC_KEY   = 'habashop_biometric_enabled'
const CREDENTIALS_KEY = 'habashop_saved_credentials'

export type BiometricType = 'face' | 'fingerprint' | 'unknown'

// Disponibilité de la biométrie sur l'appareil.
export async function isBiometricAvailable(): Promise<{
  available: boolean
  type: BiometricType
  enrolled: boolean
}> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync()
    const enrolled = await LocalAuthentication.isEnrolledAsync()
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
    const type: BiometricType =
      types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ? 'face'
      : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT) ? 'fingerprint'
      : 'unknown'
    return { available: compatible, type, enrolled }
  } catch {
    return { available: false, type: 'unknown', enrolled: false }
  }
}

// Lance l'invite biométrique. true si succès.
export async function authenticateWithBiometric(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Utiliser le mot de passe',
      cancelLabel: 'Annuler',
      disableDeviceFallback: false,
    })
    return result.success
  } catch {
    return false
  }
}

// Active la biométrie : mémorise les identifiants (SecureStore = chiffré Keychain/Keystore).
export async function enableBiometric(email: string, password: string): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true')
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify({ email, password }))
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_KEY)
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY)
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(BIOMETRIC_KEY)) === 'true'
  } catch {
    return false
  }
}

export async function getSavedCredentials(): Promise<{ email: string; password: string } | null> {
  try {
    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
