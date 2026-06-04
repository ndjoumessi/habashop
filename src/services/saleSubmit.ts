import { salesApi, isRetryableApiError } from './api'
import { enqueueAction } from './offlineQueue'
import { logger } from '@/lib/logger'
import type { SalePayload, SaleResponse } from '@/types'

// Résultat d'une soumission de vente résiliente :
//  • created : la vente est confirmée côté serveur (reçu imprimable, fidélité créditée).
//  • queued  : réseau lent/5xx persistant → mise en file offline (resync ultérieure,
//              avec la MÊME clé d'idempotence → le backend dédup, pas de doublon).
export type SaleSubmitResult =
  | { status: 'created'; sale: SaleResponse }
  | { status: 'queued' }

// Délais entre tentatives (backoff). 1 tentative initiale + 2 retries par défaut.
const DEFAULT_DELAYS = [500, 1500]

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Soumet une vente avec résilience au réseau lent (cible : Android entrée de gamme,
 * réseaux instables). Sur TIMEOUT (axios) ou 5xx : retry court AVEC LA MÊME CLÉ
 * d'idempotence (sûr car backend idempotent). Échec persistant réseau/5xx → bascule
 * en FILE OFFLINE (au lieu d'une alerte sèche). Une 4xx (validation/auth) est propagée.
 *
 * ⚠️ Le payload — clé d'idempotence incluse — n'est JAMAIS modifié entre les tentatives.
 */
export async function submitSaleResilient(
  payload: SalePayload,
  delays: number[] = DEFAULT_DELAYS,
): Promise<SaleSubmitResult> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const sale = await salesApi.create(payload)
      return { status: 'created', sale }
    } catch (err) {
      lastErr = err
      // 4xx (validation/auth) → vraie erreur, ne pas retenter ni mettre en file.
      if (!isRetryableApiError(err)) throw err
      if (attempt < delays.length) {
        logger.warn(`Vente: tentative ${attempt + 1} échouée (réseau/5xx), nouvel essai…`, err)
        await sleep(delays[attempt])
      }
    }
  }
  // Échec persistant réseau/5xx → file offline (resync renverra la même clé → dédup backend).
  logger.warn('Vente: échec réseau persistant → mise en file offline', lastErr)
  await enqueueAction('SALE', payload)
  return { status: 'queued' }
}
