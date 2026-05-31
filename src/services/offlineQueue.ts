import { logger } from '@/lib/logger'
import AsyncStorage from '@react-native-async-storage/async-storage'

const QUEUE_KEY = 'habashop_offline_queue'

export interface OfflineAction {
  id:        string
  type:      'SALE' | 'STOCK_MOVE'
  payload:   any
  createdAt: string
  synced:    boolean
}

// Ajoute une action à la file
export async function enqueueAction(
  type: OfflineAction['type'],
  payload: any,
): Promise<void> {
  try {
    const queue = await getQueue()
    const action: OfflineAction = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      payload,
      createdAt: new Date().toISOString(),
      synced:    false,
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, action]))
  } catch (err) {
    logger.error('enqueueAction error:', err)
  }
}

// Récupère la file complète
export async function getQueue(): Promise<OfflineAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// Marque une action comme synchronisée
export async function markSynced(id: string): Promise<void> {
  try {
    const queue = await getQueue()
    const updated = queue.map(a => (a.id === id ? { ...a, synced: true } : a))
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated))
  } catch {}
}

// Supprime les actions déjà synchronisées
export async function clearSynced(): Promise<void> {
  try {
    const queue = await getQueue()
    const pending = queue.filter(a => !a.synced)
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(pending))
  } catch {}
}

// Nombre d'actions en attente
export async function getPendingCount(): Promise<number> {
  const queue = await getQueue()
  return queue.filter(a => !a.synced).length
}
