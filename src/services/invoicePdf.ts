import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { apiClient } from './api'

// Endpoint backend de la facture PDF d'une vente (auth JWT, tous rôles).
export const invoiceEndpoint = (saleId: string): string => `/api/sales/${saleId}/invoice`
// Nom du fichier temporaire en cache (horodaté → pas d'écrasement, fichier jetable).
export const invoiceCacheName = (saleId: string, ts: number): string => `facture-${saleId}-${ts}.pdf`

/**
 * Télécharge la facture PDF d'une vente (binaire, JWT via l'interceptor axios), l'écrit
 * dans le cache (TEMPORAIRE, jamais de stockage permanent) puis ouvre le partage système
 * (WhatsApp / email / Drive…). Lève une erreur en cas d'échec (réseau, 4xx/5xx, partage
 * indisponible) → l'appelant affiche un toast localisé.
 */
export async function shareInvoicePdf(saleId: string, dialogTitle: string, ts: number): Promise<void> {
  // arraybuffer : le backend renvoie application/pdf brut ; timeout élargi (génération PDF).
  const res = await apiClient.get<ArrayBuffer>(invoiceEndpoint(saleId), {
    responseType: 'arraybuffer',
    timeout: 20000,
  })
  const bytes = new Uint8Array(res.data)

  const file = new File(Paths.cache, invoiceCacheName(saleId, ts))
  file.create()
  file.write(bytes)

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('sharing-unavailable')
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    dialogTitle,
    UTI: 'com.adobe.pdf',
  })
}
