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

    console.log(`Syncing ${pending.length} offline actions...`)
    for (const action of pending) {
      try {
        if (action.type === 'SALE') {
          await salesApi.create(action.payload)
          await markSynced(action.id)
        }
      } catch (err) {
        console.log(`Sync failed for ${action.id}:`, err)
      }
    }
    await clearSynced()
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['products'] })
    console.log('Sync complete')
  }, [isOnline, qc])

  // Sync automatique au retour du réseau
  useEffect(() => {
    if (isOnline) sync()
  }, [isOnline, sync])

  return { isOnline, sync }
}
