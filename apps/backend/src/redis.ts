import Redis from 'ioredis'

/**
 * Client Redis partagé (cache analytics + store rate-limit).
 * `null` si `REDIS_URL` est absent → l'app fonctionne sans cache (fallback DB)
 * et le rate-limit retombe sur un store mémoire. Aucune fonctionnalité ne
 * dépend de Redis pour être correcte : il n'accélère que les agrégats.
 */
export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
    })
  : null

// Filet de sécurité : un Redis injoignable ne doit jamais crasher le process
// (sinon l'événement 'error' non géré d'ioredis fait tomber le serveur).
if (redis) {
  redis.on('error', (err) => {
    console.warn('⚠️  Redis error (dégradation cache/rate-limit):', err?.message)
  })
}
