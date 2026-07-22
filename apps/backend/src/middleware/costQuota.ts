import * as Sentry from '@sentry/node'
import { prisma } from '../db'
import { redis } from '../redis'

/**
 * Robinet sur les endpoints à COÛT EXTERNE (Anthropic, Twilio, Resend).
 *
 * L'inscription est ouverte et sans vérification d'e-mail : tout nouveau tenant
 * est ADMIN d'un essai de 14 jours et atteignait ces endpoints sans AUCUNE limite
 * par tenant (seul plafond : 300 req/min par IP, global). Une seule IP pouvait donc
 * enchaîner des appels Opus en boucle. Ce module borne la dépense par tenant et par
 * jour, sans toucher au parcours d'inscription.
 *
 * Trois volets :
 *  (a) quota par tenant / par jour, compteur Redis, plafonds par env ;
 *  (b) le garde de rôle vit dans les routes (MANAGER+ sur /api/ai/*) ;
 *  (c) essai expiré / boutique suspendue → refus sur ces endpoints uniquement.
 *
 * ⚠️ FAIL-OPEN assumé (≠ garde démo, fail-closed) : ce mécanisme protège le COÛT,
 * pas un accès critique. Un incident Redis ne doit pas couper l'OCR d'un client
 * payant. Le rayon d'abus pendant la fenêtre est borné par l'override de rate-limit
 * serré posé sur ces routes (cf. COST_ROUTE_RATE_LIMIT). Chaque bascule est LOGGUÉE
 * (console + Sentry) : sans trace, on ne saurait jamais si le fail-open a été
 * exploité — c'est la trace qui protège, pas la branche.
 */

export type CostKind = 'ai' | 'ocr' | 'whatsapp'

export const QUOTA_EXCEEDED = 'QUOTA_EXCEEDED'
export const TRIAL_EXPIRED = 'TRIAL_EXPIRED'
export const TENANT_INACTIVE = 'TENANT_INACTIVE'

/**
 * Override de rate-limit à poser sur les routes à coût — tient même sans Redis
 * (le store mémoire prend le relais) et borne le rayon d'abus pendant un fail-open.
 * `max` est une FONCTION → relue à chaque requête, donc ajustable par env sans
 * redéploiement (l'objet, lui, serait figé à l'enregistrement de la route).
 */
export const COST_ROUTE_RATE_LIMIT = {
  max: () => Number(process.env.COST_RATE_LIMIT_MAX) || 10,
  timeWindow: '1 minute',
}

// Plafonds par env, lus À L'APPEL (pas en constante de module) → ajustables en prod
// sans redéploiement, et réellement exerçables par les tests via process.env.
const DEFAULTS: Record<CostKind, { trial: number; active: number }> = {
  ai:       { trial: 20,  active: 200 },
  ocr:      { trial: 15,  active: 150 },
  whatsapp: { trial: 30,  active: 300 },
}
const ENV_KEY: Record<CostKind, string> = { ai: 'AI', ocr: 'OCR', whatsapp: 'WHATSAPP' }

/** Plafond quotidien pour ce type d'appel et ce statut de boutique. */
export function quotaLimit(kind: CostKind, status: string): number {
  const tier = status === 'trial' ? 'trial' : 'active'
  const env = process.env[`QUOTA_${tier.toUpperCase()}_${ENV_KEY[kind]}`]
  const parsed = Number(env)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULTS[kind][tier]
}

type TenantState = { status: string; trialEnds: Date | null }
// Forme UNIQUE plutôt qu'une union discriminée : ce workspace compile en
// `strict: false`, où le narrowing sur un littéral booléen ne s'applique pas.
type Decision = { ok: boolean; code?: string; message?: string }

/**
 * (c) La boutique a-t-elle le droit d'engager une dépense ?
 * Suspendue/annulée → non. Essai échu → non. Le reste de l'app n'est PAS concerné :
 * ce verrou ne vaut que sur les endpoints à coût.
 */
export function tenantSpendState(t: TenantState | null, now: Date = new Date()): Decision {
  if (!t) return { ok: false, code: TENANT_INACTIVE, message: 'Boutique introuvable' }
  if (t.status === 'suspended' || t.status === 'cancelled') {
    return { ok: false, code: TENANT_INACTIVE, message: 'Boutique suspendue — service indisponible' }
  }
  if (t.status === 'trial' && t.trialEnds && t.trialEnds.getTime() < now.getTime()) {
    return { ok: false, code: TRIAL_EXPIRED, message: 'Période d\'essai terminée — activez un plan pour continuer' }
  }
  return { ok: true }
}

/** Clé du compteur : un seau par tenant, par type d'appel et par jour (UTC). */
export function quotaKey(tenantId: string, kind: CostKind, now: Date = new Date()): string {
  return `quota:${kind}:${tenantId}:${now.toISOString().slice(0, 10)}`
}

/** Trace explicite d'une bascule en fail-open — visible après coup (console + Sentry). */
function logFailOpen(tenantId: string, kind: CostKind, err: unknown): void {
  const msg = `[cost-quota] FAIL-OPEN — quota non compté (Redis indisponible) tenant=${tenantId} kind=${kind}`
  console.warn(msg, err instanceof Error ? err.message : err)
  Sentry.captureMessage(msg, { level: 'warning', extra: { tenantId, kind, reason: String(err) } } as any)
}

export type Consumption = { allowed: boolean; used: number; limit: number; degraded: boolean }

/**
 * (a) Incrémente et évalue le compteur du jour.
 * Compté À L'ENTRÉE : on borne le nombre d'appels engagés, pas le nombre de succès
 * (une requête qui échoue plus loin ne coûte rien mais reste un appel tenté).
 */
export async function consumeQuota(tenantId: string, kind: CostKind, status: string, now: Date = new Date()): Promise<Consumption> {
  const limit = quotaLimit(kind, status)
  if (!redis) {
    logFailOpen(tenantId, kind, 'REDIS_URL absent')
    return { allowed: true, used: 0, limit, degraded: true }
  }
  try {
    const key = quotaKey(tenantId, kind, now)
    const used = await redis.incr(key)
    if (used === 1) await redis.expire(key, 36 * 3600) // > 24 h : couvre tous les fuseaux
    return { allowed: used <= limit, used, limit, degraded: false }
  } catch (err) {
    logFailOpen(tenantId, kind, err)
    return { allowed: true, used: 0, limit, degraded: true }
  }
}

/**
 * preHandler à poser APRÈS `authenticate` (et après `blockDemoTenant`).
 * Refuse : 403 essai échu / boutique suspendue, 429 quota atteint.
 */
/**
 * Hook `onResponse` global : rend l'unité consommée quand la requête finit en 400.
 * Un 400 = validation (fichier manquant, message vide, corps invalide) → AUCUN appel
 * externe engagé, donc aucun coût : le décompte serait une pénalité gratuite. Les
 * autres codes (429 plafond, 5xx après appel) ne sont PAS remboursés.
 */
export async function refundQuotaHook(request: any, reply: any): Promise<void> {
  const key = request.__quotaKey
  if (!key || reply.statusCode !== 400 || !redis) return
  try { await redis.decr(key) } catch { /* non bloquant : au pire l'unité reste comptée */ }
}

export function costQuota(kind: CostKind) {
  return async function costQuotaHandler(request: any, reply: any): Promise<void> {
    const tenantId = request.tenantId
    if (!tenantId) return // `authenticate` a déjà tranché (400 NO_ACTIVE_TENANT)

    let tenant: TenantState | null = null
    try {
      tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { status: true, trialEnds: true },
      })
    } catch (err) {
      // DB KO : même logique de coût que Redis — on laisse passer, on trace.
      logFailOpen(tenantId, kind, err)
      return
    }

    const state = tenantSpendState(tenant)
    if (!state.ok) {
      return reply.code(403).send({ error: state.message, code: state.code })
    }

    const { allowed, used, limit, degraded } = await consumeQuota(tenantId, kind, tenant!.status)
    // Unité consommée : mémorisée pour être RENDUE si la requête échoue en 400
    // (validation) — aucun appel externe n'a alors été engagé. Cf. refundQuotaHook.
    if (!degraded) request.__quotaKey = quotaKey(tenantId, kind)
    if (!allowed) {
      return reply.code(429).send({
        error: `Plafond quotidien atteint (${used - 1}/${limit} aujourd'hui). Réessayez demain ou activez un plan supérieur.`,
        code: QUOTA_EXCEEDED,
        kind,
        used: used - 1, // appels déjà consommés AVANT celui-ci (refusé)
        limit,
      })
    }
  }
}
