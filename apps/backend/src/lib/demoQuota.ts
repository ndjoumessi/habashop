import { redis } from '../redis'
import * as Sentry from '@sentry/node'

/**
 * PLAFOND GLOBAL de créations de démos par jour.
 *
 * ⚠️ C'est LUI qui borne la croissance de la base. Le plafond par IP de `@fastify/rate-limit`
 * est volontairement généreux : le CGNAT ouest-africain fait partager une IP à des boutiques
 * sans lien, et les caisses d'un même magasin sortent par la même adresse. Un plafond serré
 * par IP refuserait des visiteurs légitimes — c'est la raison pour laquelle la rafale du
 * garde de dépense est par TENANT, pas par IP.
 *
 * ⚠️ Lu À L'APPEL (ajustable sans redéploiement), et SANS `|| <défaut>` : `Number('0') || 200`
 * rendrait la désactivation inopérante.
 *
 * ⚠️ FAIL-CLOSED TRACÉ si Redis est indisponible, et c'est un RENVERSEMENT ASSUMÉ.
 *
 * La première version faisait fail-OPEN, sur le raisonnement « un incident Redis ne doit pas
 * fermer la vitrine, et le plafond par IP tient toujours ». Ce repli N'EXISTE PAS : Fastify
 * tourne avec `trustProxy: true` (`server.ts:111`), donc `request.ip` est lu dans
 * `X-Forwarded-For`, un en-tête que l'appelant contrôle entièrement. Une boucle qui fait
 * varier cet en-tête obtient une clé de rate-limit différente à chaque requête et n'atteint
 * jamais les 20/h.
 *
 * Sans Redis, un fail-open laissait donc la création de tenants bornée par RIEN : des
 * milliers de tenants, des millions de lignes, jusqu'à saturation du disque Postgres de
 * PRODUCTION, depuis l'internet public et sans authentification. La démo est une commodité ;
 * la base de production ne l'est pas.
 *
 * ⚠️ Deux gardes qui se citent mutuellement comme filet, et aucun des deux ne tient seul :
 * c'est la même erreur que le `notify-failure` sortant en `exit 0`.
 *
 * ⚠️ Le refus est TRACÉ : un fail-closed muet rendrait un incident Redis indistinguable d'un
 * afflux légitime de visiteurs, et la vitrine cesserait de proposer la démo sans que personne
 * ne sache pourquoi.
 */

export const DEMO_QUOTA_EXCEEDED = 'DEMO_QUOTA_EXCEEDED'

/**
 * Refus parce qu'on ne PEUT PAS compter, distinct du plafond atteint.
 * ⚠️ Les fondre dirait au visiteur une chose fausse (« trop de démos aujourd'hui » quand il
 * n'y en a aucune) et priverait l'exploitant du signal qui distingue un incident Redis d'un
 * afflux légitime.
 */
export const DEMO_QUOTA_UNAVAILABLE = 'DEMO_QUOTA_UNAVAILABLE'

const DEFAUT_PAR_JOUR = 200

/** Plafond courant. `undefined`/`''` → défaut ; `'0'` → zéro (désactivation effective). */
export function demoQuotaPerDay(env: NodeJS.ProcessEnv = process.env): number {
  const brut = (env.DEMO_QUOTA_PER_DAY ?? '').trim()
  if (brut === '') return DEFAUT_PAR_JOUR
  const n = Number(brut)
  return Number.isFinite(n) && n >= 0 ? n : DEFAUT_PAR_JOUR
}

const cle = (jour: string) => `demo:start:${jour}`

/**
 * Réserve un créneau de création.
 * @returns `ok` — la création est autorisée · `failClosed` — refusée faute de pouvoir
 *          compter (Redis indisponible), et non parce que le plafond est atteint
 */
export async function reserveDemoSlot(now = new Date()): Promise<{ ok: boolean; failClosed: boolean }> {
  const plafond = demoQuotaPerDay()
  // Désactivation explicite : on refuse sans même solliciter Redis.
  if (plafond === 0) return { ok: false, failClosed: false }
  if (!redis) {
    Sentry.captureMessage('[demo-quota] FAIL-CLOSED — Redis absent, la démo en libre-service est refusée', { level: 'warning' })
    return { ok: false, failClosed: true }
  }
  try {
    const k = cle(now.toISOString().slice(0, 10))
    const n = await redis.incr(k)
    // Expiration posée au PREMIER incrément seulement : la repousser à chaque appel
    // ferait une clé qui ne meurt jamais tant que le trafic dure.
    if (n === 1) await redis.expire(k, 48 * 3600)
    return { ok: n <= plafond, failClosed: false }
  } catch (e) {
    Sentry.captureMessage('[demo-quota] FAIL-CLOSED — Redis en échec, la démo en libre-service est refusée', {
      level: 'warning', extra: { erreur: String(e) },
    })
    return { ok: false, failClosed: true }
  }
}

/**
 * Rend un créneau réservé dont la création a ÉCHOUÉ.
 *
 * ⚠️ Sans cela, le compteur mesurait les TENTATIVES et non les démos existantes : une
 * régression du jeu de données, ou un pool de connexions saturé, consommait les 200 créneaux
 * du jour sur des créations avortées, et le bouton annonçait « le nombre de démonstrations
 * ouvertes aujourd'hui est atteint » alors que zéro démo n'existait.
 *
 * ⚠️ Non bloquant et silencieux en cas d'échec : ne pas rendre un créneau coûte une démo,
 * faire échouer la réponse pour cela en coûterait une aussi, et la première est déjà perdue.
 */
export async function releaseDemoSlot(now = new Date()): Promise<void> {
  if (!redis) return
  try {
    await redis.decr(cle(now.toISOString().slice(0, 10)))
  } catch {
    /* le compteur retombera à l'expiration de la clé (48 h) */
  }
}
