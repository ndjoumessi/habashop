import { useState, useCallback } from 'react'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { apiClient, apiErrorMessage } from '@/services/api'
import type { OcrInvoiceResult } from '@/types'
import { logger } from '@/lib/logger'

export type OcrSource = 'camera' | 'gallery'

// Rôles autorisés par le backend (`/api/suppliers/scan-invoice` renvoie 403 sinon).
// Casse normalisée : `role` n'est pas garantie canonique d'un bout à l'autre.
const OCR_ROLES = ['MANAGER', 'ADMIN', 'SUPER_ADMIN']
export const canScanInvoiceRole = (role?: string | null): boolean =>
  OCR_ROLES.includes(String(role ?? '').trim().toUpperCase())

// Compression avant envoi : re-encode TOUJOURS en JPEG (qualité 0.7) et plafonne
// la largeur à 1920 px → mimeType uniforme `image/jpeg` + payload borné (l'endpoint
// rejette > 10 Mo). On ne redimensionne que si l'image dépasse 1920 (pas d'upscale).
const MAX_WIDTH = 1920
async function compress(uri: string, width?: number): Promise<string> {
  const actions: ImageManipulator.Action[] =
    width && width > MAX_WIDTH ? [{ resize: { width: MAX_WIDTH } }] : []
  const out = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: 0.7,
    format: ImageManipulator.SaveFormat.JPEG,
  })
  return out.uri
}

interface OcrState {
  isLoading: boolean
  error: string | null
  result: OcrInvoiceResult | null
}

/**
 * Flux OCR facture fournisseur (lecture seule, OTA-safe) :
 *  1. picker caméra OU galerie selon `source`
 *  2. compression JPEG locale (qualité 0.7, largeur ≤ 1920)
 *  3. POST multipart `/api/suppliers/scan-invoice` (champ `invoice`) via l'apiClient
 *     authentifié — AUCUNE clé API côté mobile, tout passe par le backend.
 * Retourne { isLoading, error, result, scan, reset }. L'annulation du picker
 * ne déclenche NI erreur NI chargement.
 */
export function useSupplierOcr() {
  const [state, setState] = useState<OcrState>({ isLoading: false, error: null, result: null })

  const reset = useCallback(() => setState({ isLoading: false, error: null, result: null }), [])

  const scan = useCallback(async (source: OcrSource): Promise<void> => {
    // 1. Permission (selon la source) — refus = message dédié, pas de throw.
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') {
      setState({ isLoading: false, result: null, error: 'permission_denied' })
      return
    }

    // 2. Picker — annulation = on ne touche à rien (ni loading ni erreur).
    const picked = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 })
    if (picked.canceled) return

    const asset = picked.assets[0]
    if (!asset?.uri) return

    setState({ isLoading: true, error: null, result: null })
    try {
      const uri = await compress(asset.uri, asset.width)

      // 3. Upload multipart. ⚠️ override du Content-Type (l'apiClient est JSON par
      // défaut) + timeout long : Claude Vision met plusieurs secondes à répondre.
      const fd = new FormData()
      fd.append('invoice', { uri, name: 'invoice.jpg', type: 'image/jpeg' } as any)
      const { data } = await apiClient.post<OcrInvoiceResult>(
        '/api/suppliers/scan-invoice',
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 },
      )
      setState({ isLoading: false, error: null, result: data })
    } catch (e) {
      logger.warn('useSupplierOcr scan failed:', e)
      setState({
        isLoading: false,
        result: null,
        error: apiErrorMessage(e) ?? 'scan_failed',
      })
    }
  }, [])

  return { ...state, scan, reset }
}
