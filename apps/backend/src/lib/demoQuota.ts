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
 * ⚠️ FAIL-OPEN TRACÉ si Redis est indisponible. Asymétrie assumée, la même que le garde de
 * dépense : un incident Redis ne doit pas fermer la vitrine, et le plafond par IP tient
 * toujours. Le fail-open est SIGNALÉ — un fail-open muet rendrait l'absence de plafond
 * indistinguable d'un plafond respecté.
 */

export const DEMO_QUOTA_EXCEEDED = 'DEMO_QUOTA_EXCEEDED'

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
 * @returns `ok` — la création est autorisée · `failOpen` — décidée sans Redis (donc tracée)
 */
export async function reserveDemoSlot(now = new Date()): Promise<{ ok: boolean; failOpen: boolean }> {
  const plafond = demoQuotaPerDay()
  // Désactivation explicite : on refuse sans même solliciter Redis.
  if (plafond === 0) return { ok: false, failOpen: false }
  if (!redis) {
    Sentry.captureMessage('[demo-quota] FAIL-OPEN — Redis absent, plafond global non appliqué', { level: 'warning' })
    return { ok: true, failOpen: true }
  }
  try {
    const k = cle(now.toISOString().slice(0, 10))
    const n = await redis.incr(k)
    // Expiration posée au PREMIER incrément seulement : la repousser à chaque appel
    // ferait une clé qui ne meurt jamais tant que le trafic dure.
    if (n === 1) await redis.expire(k, 48 * 3600)
    return { ok: n <= plafond, failOpen: false }
  } catch (e) {
    Sentry.captureMessage('[demo-quota] FAIL-OPEN — Redis en échec, plafond global non appliqué', {
      level: 'warning', extra: { erreur: String(e) },
    })
    return { ok: true, failOpen: true }
  }
}
