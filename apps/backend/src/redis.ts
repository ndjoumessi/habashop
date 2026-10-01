import Redis from 'ioredis'

/**
 * Client Redis partagé (cache analytics + store rate-limit).
 * `null` si `REDIS_URL` est absent → l'app fonctionne sans cache (fallback DB)
 * et le rate-limit retombe sur un store mémoire.
 *
 * ⚠️ « Aucune fonctionnalité ne dépend de Redis pour être correcte » — CETTE PHRASE ÉTAIT
 * ICI ET ELLE EST DEVENUE FAUSSE le 2026-10-01. `POST /api/demo/start` est FAIL-CLOSED sur
 * le plafond global, qui vit dans Redis (`lib/demoQuota.ts`) : sans Redis, la démo en
 * libre-service répond 503 et le bouton de la vitrine ne fonctionne plus. C'était un choix —
 * le plafond par IP ne borne rien derrière `trustProxy: true`, donc un fail-open laissait la
 * création de tenants illimitée depuis l'internet public.
 *
 * Reste vrai : le CACHE et le rate-limit dégradent proprement sans Redis. Ce qui a changé,
 * c'est qu'une fonctionnalité s'y adosse désormais, et l'état réel de Redis est SONDÉ par
 * `/api/health-extended` (`lib/healthProbe.ts`), plus seulement déclaré.
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
