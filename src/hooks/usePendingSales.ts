import { useEffect, useState } from 'react'
import { getPendingCount } from '@/services/offlineQueue'
import { useNetworkStatus } from './useNetworkStatus'

// Lecture SEULE du nombre de ventes en file offline (≠ useOfflineSync qui, lui, lance la
// boucle de resync). Sert aux bannières d'écran : on évite ainsi d'instancier plusieurs
// boucles de sync concurrentes (une seule vit dans <OfflineSyncBridge/>). Poll léger 4 s
// + rafraîchi à chaque changement d'état réseau.
export function usePendingSales(): number {
  const { isOnline } = useNetworkStatus()
  const [count, setCount] = useState(0)

  useEffect(() => {
    let alive = true
    const read = async () => { const n = await getPendingCount(); if (alive) setCount(n) }
    read()
    const id = setInterval(read, 4000)
    return () => { alive = false; clearInterval(id) }
  }, [isOnline])

  return count
}
