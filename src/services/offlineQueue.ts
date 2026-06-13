import { logger } from '@/lib/logger'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { SalePayload } from '@/types'

const QUEUE_KEY = 'habashop_offline_queue'

// Nombre maximum de tentatives de resync avant abandon d'une action (cf. useOfflineSync).
// Au-delà, l'action est retirée de la file + loggée (sinon une action en échec réseau
// persistant bouclerait indéfiniment toutes les 30 s).
export const MAX_QUEUE_RETRIES = 3

// Seule la VENTE est mise en file offline. Le stock est décrémenté AUTOMATIQUEMENT côté
// serveur dans la transaction de vente (replay idempotent) → aucun mouvement de stock à
// rejouer séparément. (L'ancien type 'STOCK_MOVE' était mort : aucun producteur/consommateur.)
export interface OfflineAction {
  id:        string
  type:      'SALE'
  payload:   SalePayload
  createdAt: string
  // Tentatives de resync déjà effectuées (réseau/5xx). Plafonné à MAX_QUEUE_RETRIES.
  retries:   number
}

// Ajoute une action à la file (FIFO — ordre d'insertion = ordre de rejeu).
export async function enqueueAction(
  type: OfflineAction['type'],
  payload: SalePayload,
): Promise<void> {
  try {
    const queue = await getQueue()
    const action: OfflineAction = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      retries:   0,
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, action]))
  } catch (err) {
    logger.error('enqueueAction error:', err)
  }
}

// Récupère la file complète. Tolère l'ancien format (actions sans `retries`) → normalisé à 0.
export async function getQueue(): Promise<OfflineAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OfflineAction[]
    return parsed.map(a => ({ ...a, retries: a.retries ?? 0 }))
  } catch {
    return []
  }
}

// Retire une action de la file (succès serveur OU 4xx définitif OU abandon après N retries).
export async function removeAction(id: string): Promise<void> {
  try {
    const queue = await getQueue()
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.filter(a => a.id !== id)))
  } catch (e) {
    logger.warn('offlineQueue removeAction échoué:', e)
  }
}

// Incrémente le compteur de tentatives d'une action (échec réseau/5xx → on retentera).
export async function incrementRetries(id: string): Promise<void> {
  try {
    const queue = await getQueue()
    const updated = queue.map(a => (a.id === id ? { ...a, retries: a.retries + 1 } : a))
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated))
  } catch (e) {
    logger.warn('offlineQueue incrementRetries échoué:', e)
  }
}

// Nombre d'actions en attente de synchronisation.
export async function getPendingCount(): Promise<number> {
  const queue = await getQueue()
  return queue.length
}
