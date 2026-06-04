import { logger } from '@/lib/logger'
import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNetworkStatus } from './useNetworkStatus'
import { getQueue, markSynced, clearSynced } from '@/services/offlineQueue'
import { salesApi } from '@/services/api'

export function useOfflineSync() {
  const { isOnline } = useNetworkStatus()
  const qc = useQueryClient()

  const sync = useCallback(async () => {
    if (!isOnline) return
    const queue = await getQueue()
    const pending = queue.filter(a => !a.synced)
    if (pending.length === 0) return

    logger.log(`Syncing ${pending.length} offline actions...`)
    for (const action of pending) {
      try {
        if (action.type === 'SALE') {
          await salesApi.create(action.payload)
          await markSynced(action.id)
        }
      } catch (err) {
        logger.warn(`Sync failed for ${action.id}:`, err)
      }
    }
    await clearSynced()
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    logger.log('Sync complete')
  }, [isOnline, qc])

  // Sync automatique au retour du réseau
  useEffect(() => {
    if (isOnline) sync()
  }, [isOnline, sync])

  // Filet périodique : une vente peut être mise en file ALORS qu'on est « en ligne »
  // mais lent/5xx (cf. submitSaleResilient) — aucun changement d'état réseau ne
  // déclencherait sinon la resync. On reflush toutes les 30 s (no-op si offline/file vide).
  useEffect(() => {
    const id = setInterval(() => { sync() }, 30_000)
    return () => clearInterval(id)
  }, [sync])

  return { isOnline, sync }
}
