import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Query } from '@tanstack/react-query'

// Persistance du cache TanStack Query dans AsyncStorage → les listes restent consultables
// HORS-LIGNE même après que l'app a été tuée (le QueryClient seul est en mémoire volatile :
// app rouverte sans réseau = écrans vides sinon). OTA-safe : 100 % JS, aucune dep native.

// Durée de validité du cache persisté. Doit rester ≤ gcTime du QueryClient (cf. _layout)
// pour que les requêtes restaurées ne soient pas immédiatement éligibles au garbage-collect.
export const PERSIST_MAX_AGE = 1000 * 60 * 60 * 24 // 24 h

// Seules ces listes sont persistées (consultation offline) ; on N'écrit PAS les requêtes
// volatiles/sensibles (fidélité, /me…). Les ventes hors-ligne, elles, vivent dans la file
// dédiée (offlineQueue), pas dans ce cache.
const PERSISTED_KEYS = ['products', 'customers', 'dashboard']

export const asyncStoragePersister = createAsyncStoragePersister({
  storage:      AsyncStorage,
  key:          'habashop_rq_cache',
  throttleTime: 1000, // regroupe les écritures rapprochées
})

// Ne déshydrate (persiste) qu'une requête RÉUSSIE faisant partie de la liste blanche.
export function shouldDehydrateQuery(query: Query): boolean {
  const root = Array.isArray(query.queryKey) ? String(query.queryKey[0]) : ''
  return query.state.status === 'success' && PERSISTED_KEYS.includes(root)
}
