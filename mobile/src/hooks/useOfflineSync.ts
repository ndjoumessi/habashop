import { logger } from '@/lib/logger'
import { useEffect, useCallback, useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNetworkStatus } from './useNetworkStatus'
import {
  getQueue, removeAction, incrementRetries, MAX_QUEUE_RETRIES,
} from '@/services/offlineQueue'
import { salesApi, isRetryableApiError, apiErrorMessage } from '@/services/api'

// Signal émis après une resync : `count` actions synchronisées avec succès à l'instant `at`
// (le timestamp sert de nonce → deux batches de même taille re-déclenchent bien le toast).
export interface SyncSignal { count: number; at: number }

export function useOfflineSync() {
  const { isOnline } = useNetworkStatus()
  const qc = useQueryClient()
  const [pendingCount, setPendingCount] = useState(0)
  const [lastSync, setLastSync] = useState<SyncSignal | null>(null)
  // Garde anti-double-sync : reconnexion réseau ET filet 30 s peuvent tomber en même temps.
  const syncing = useRef(false)

  const refreshPending = useCallback(async () => {
    setPendingCount((await getQueue()).length)
  }, [])

  const sync = useCallback(async () => {
    if (!isOnline || syncing.current) return
    const queue = await getQueue()
    if (queue.length === 0) return
    syncing.current = true
    let synced = 0
    try {
      logger.log(`Syncing ${queue.length} offline action(s)...`)
      // FIFO strict : on rejoue dans l'ordre d'insertion (les ventes s'appliquent en séquence).
      for (const action of queue) {
        try {
          if (action.type === 'SALE') await salesApi.create(action.payload)
          await removeAction(action.id)   // succès serveur (ou doublon idempotent renvoyé)
          synced++
        } catch (err) {
          if (!isRetryableApiError(err)) {
            // 4xx (validation/auth) : rejouer ne corrigera jamais → on retire + log,
            // sinon une vente invalide bouclerait indéfiniment toutes les 30 s.
            logger.error(`Sync ${action.id} rejetée (4xx, abandon) :`, apiErrorMessage(err))
            await removeAction(action.id)
            continue
          }
          if (action.retries + 1 >= MAX_QUEUE_RETRIES) {
            // Réseau/5xx persistant après N tentatives → abandon (évite la boucle infinie).
            logger.error(`Sync ${action.id} abandonnée après ${MAX_QUEUE_RETRIES} tentatives :`, err)
            await removeAction(action.id)
            continue
          }
          // Réseau/5xx transitoire → on retentera au prochain cycle. On N'AVANCE PAS
          // au-delà (break) pour préserver l'ordre FIFO : la suivante attend la reprise.
          await incrementRetries(action.id)
          logger.warn(`Sync ${action.id} échouée (tentative ${action.retries + 1}/${MAX_QUEUE_RETRIES}) :`, err)
          break
        }
      }
    } finally {
      syncing.current = false
    }
    if (synced > 0) {
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      setLastSync({ count: synced, at: Date.now() })
      logger.log(`Sync terminée : ${synced} action(s)`)
    }
    await refreshPending()
  }, [isOnline, qc, refreshPending])

  // Compteur en attente au montage + à chaque changement d'état réseau.
  useEffect(() => { refreshPending() }, [refreshPending, isOnline])

  // Sync automatique au retour du réseau.
  useEffect(() => {
    if (isOnline) sync()
  }, [isOnline, sync])

  // Filet périodique : une vente peut être mise en file ALORS qu'on est « en ligne »
  // mais lent/5xx (cf. submitSaleResilient) — aucun changement d'état réseau ne
  // déclencherait sinon la resync. On reflush + rafraîchit le compteur toutes les 30 s.
  useEffect(() => {
    const id = setInterval(() => { refreshPending(); sync() }, 30_000)
    return () => clearInterval(id)
  }, [sync, refreshPending])

  return { isOnline, sync, pendingCount, lastSync }
}
