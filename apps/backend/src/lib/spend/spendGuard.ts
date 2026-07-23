import * as Sentry from '@sentry/node'
import { prisma } from '../../db'
import { redis } from '../../redis'

/**
 * Autorisation de DÉPENSE EXTERNE — décision unique, au point de dépense.
 *
 * Les gardes posées route par route laissaient passer tout ce qui dépense hors requête :
 * le reçu WhatsApp automatique déclenché par `POST /api/sales`, et les crons 20h/8h qui
 * parcourent tous les tenants. D'où la résolution par `tenantId` (jamais depuis `request`)
 * et l'appel depuis les clients gardés eux-mêmes : un chemin qui dépense DOIT passer ici,
 * qu'il ait un contexte HTTP ou non.
 *
 * Ordre : démo → statut/essai → quota. Une seule lecture tenant, cachée 60 s.
 *
 * ⚠️ Asymétrie assumée sur les pannes :
 *  • démo / statut → FAIL-CLOSED (refuser une démo ne coûte rien de légitime, et ces
 *    chemins ont de toute façon besoin de la DB pour produire quoi que ce soit) ;
 *  • quota Redis   → FAIL-OPEN tracé (un incident Redis ne doit pas couper l'OCR ni les
 *    reçus d'un client payant). Sans la trace, un fail-open exploité serait invisible.
 */

// `whatsapp` = flux TRANSACTIONNEL (reçus, alertes, crons) — seau SACRÉ, jamais
// coupé par le marketing. `whatsapp_marketing` = diffusions/campagnes, seau SÉPARÉ à
// plafond bas. La clé `whatsapp` est INCHANGÉE → aucun compteur existant n'est remis
// à zéro en cours de journée par ce split.
export type SpendKind = 'ai' | 'ocr' | 'whatsapp' | 'whatsapp_marketing' | 'email'

export const DEMO_TENANT_FORBIDDEN = 'DEMO_TENANT_FORBIDDEN'
export const TRIAL_EXPIRED         = 'TRIAL_EXPIRED'
export const TENANT_INACTIVE       = 'TENANT_INACTIVE'
export const QUOTA_EXCEEDED        = 'QUOTA_EXCEEDED'
export const BURST_EXCEEDED        = 'BURST_EXCEEDED'

// Forme UNIQUE plutôt qu'une union discriminée : ce workspace compile en `strict: false`,
// où le narrowing sur un littéral booléen ne s'applique pas.
export type SpendDecision = {
  ok: boolean
  used: number
  limit: number
  degraded?: boolean
  code?: string
  message?: string
  remaining?: number
  /** Clé du compteur réservé — à repasser à `releaseQuota` (cf. bascule de minuit). */
  quotaKey?: string
}

// Plafonds lus À L'APPEL (pas en constante de module) → ajustables par env sans
// redéploiement, et réellement exerçables par les tests.
const DEFAULTS: Record<SpendKind, { trial: number; active: number }> = {
  ai:       { trial: 20,  active: 200 },
  ocr:      { trial: 15,  active: 150 },
  whatsapp: { trial: 30,  active: 300 },
  // ⚠️ PLACEHOLDER conservateur — chaque message marketing coûte de l'argent Twilio
  // réel. Un refus + message honnête vaut mieux qu'une facture surprise. Le CHIFFRE
  // exact relève du produit/facturation : à fixer via QUOTA_TRIAL_WHATSAPP_MARKETING
  // / QUOTA_ACTIVE_WHATSAPP_MARKETING (lus à l'appel, sans redéploiement). On part bas.
  whatsapp_marketing: { trial: 10, active: 50 },
  email:    { trial: 20,  active: 200 },
}
const ENV_KEY: Record<SpendKind, string> = {
  ai: 'AI', ocr: 'OCR', whatsapp: 'WHATSAPP', whatsapp_marketing: 'WHATSAPP_MARKETING', email: 'EMAIL',
}

export function quotaLimit(kind: SpendKind, status: string): number {
  const tier = status === 'trial' ? 'trial' : 'active'
  const parsed = Number(process.env[`QUOTA_${tier.toUpperCase()}_${ENV_KEY[kind]}`])
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULTS[kind][tier]
}

export function quotaKey(tenantId: string, kind: SpendKind, now: Date = new Date()): string {
  return `quota:${kind}:${tenantId}:${now.toISOString().slice(0, 10)}`
}

type TenantSpendInfo = { isDemo: boolean; status: string; trialEnds: Date | null }
const CTX_KEY = (id: string) => `tenant:spend:${id}`
const CTX_TTL = 60

/** Lecture tenant unique (isDemo + statut + fin d'essai), cachée 60 s. */
export async function resolveTenantSpendInfo(tenantId: string): Promise<TenantSpendInfo | null> {
  if (redis) {
    try {
      const cached = await redis.get(CTX_KEY(tenantId))
      if (cached) {
        const p = JSON.parse(cached)
        return { isDemo: p.d, status: p.s, trialEnds: p.t ? new Date(p.t) : null }
      }
    } catch { /* Redis indisponible → DB */ }
  }
  const t = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { isDemo: true, status: true, trialEnds: true },
  })
  if (t && redis) {
    try {
      await redis.setex(CTX_KEY(tenantId), CTX_TTL, JSON.stringify({ d: t.isDemo, s: t.status, t: t.trialEnds?.toISOString() ?? null }))
    } catch { /* non bloquant */ }
  }
  return t
}

/** Invalide le cache d'un tenant (bascule de flag, changement de plan). */
export async function invalidateTenantSpendInfo(tenantIds: string[]): Promise<void> {
  if (!redis || tenantIds.length === 0) return
  try { await redis.del(...tenantIds.map(CTX_KEY)) } catch { /* non bloquant */ }
}

/** Décision pure sur l'état du tenant (hors quota) — testable et datable. */
export function tenantSpendState(t: TenantSpendInfo | null, now: Date = new Date()): { ok: boolean; code?: string; message?: string } {
  if (!t) return { ok: false, code: TENANT_INACTIVE, message: 'Boutique introuvable' }
  if (t.isDemo) return { ok: false, code: DEMO_TENANT_FORBIDDEN, message: 'Action indisponible sur une boutique de démonstration' }
  if (t.status === 'suspended' || t.status === 'cancelled') {
    return { ok: false, code: TENANT_INACTIVE, message: 'Boutique suspendue — service indisponible' }
  }
  if (t.status === 'trial' && t.trialEnds && t.trialEnds.getTime() < now.getTime()) {
    return { ok: false, code: TRIAL_EXPIRED, message: 'Période d\'essai terminée — activez un plan pour continuer' }
  }
  return { ok: true }
}

function logFailOpen(tenantId: string, kind: SpendKind, err: unknown): void {
  const msg = `[spend-guard] FAIL-OPEN — quota non compté (Redis indisponible) tenant=${tenantId} kind=${kind}`
  console.warn(msg, err instanceof Error ? err.message : err)
  Sentry.captureMessage(msg, { level: 'warning', extra: { tenantId, kind, reason: String(err) } })
}

/**
 * Réserve `units` unités de quota. Le compteur mesure des MESSAGES/APPELS réels,
 * pas des requêtes HTTP : une campagne de N destinataires réserve N.
 * Si la réservation dépasse le plafond, elle est intégralement rendue et refusée
 * (pas d'envoi tronqué à mi-cible).
 */
const QUOTA_TTL = 36 * 3600 // > 24 h : couvre tous les fuseaux

async function reserveQuota(tenantId: string, kind: SpendKind, units: number, status: string): Promise<SpendDecision> {
  const limit = quotaLimit(kind, status)
  if (!redis) {
    logFailOpen(tenantId, kind, 'REDIS_URL absent')
    return { ok: true, used: 0, limit, degraded: true }
  }
  try {
    const key = quotaKey(tenantId, kind)
    const used = await redis.incrby(key, units)
    // ⚠️ TTL posé SYSTÉMATIQUEMENT, pas seulement au premier appel du jour.
    // L'ancienne condition `used === units` laissait sans expiration toute clé créée
    // par un DECRBY (libération à cheval sur minuit UTC) : elle démarrait la journée
    // en négatif ET restait en base indéfiniment.
    await redis.expire(key, QUOTA_TTL)
    if (used > limit) {
      await releaseQuota(tenantId, kind, units, key) // rien n'a été envoyé → on rend tout
      const already = Math.max(0, used - units)
      return {
        ok: false, code: QUOTA_EXCEEDED, quotaKey: key,
        message: `Plafond quotidien atteint : ${already}/${limit} utilisés aujourd'hui, ${units} requis, ${Math.max(0, limit - already)} restant. Réessayez demain ou activez un plan supérieur.`,
        used: already, limit, remaining: Math.max(0, limit - already),
      }
    }
    return { ok: true, used, limit, degraded: false, quotaKey: key }
  } catch (err) {
    logFailOpen(tenantId, kind, err)
    return { ok: true, used: 0, limit, degraded: true }
  }
}

/**
 * Plafond de rafale, lu à l'appel. ⚠️ PAS de `|| 10` : `Number('0') || 10` vaut 10,
 * ce qui rendait la désactivation explicite (`COST_BURST_PER_MIN=0`) inopérante.
 */
function burstMax(): number {
  const raw = process.env.COST_BURST_PER_MIN
  if (raw === undefined || raw.trim() === '') return 10
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : 10
}

/**
 * Rafale courte PAR TENANT (et non par IP).
 *
 * ⚠️ Pourquoi pas `@fastify/rate-limit` : son hook s'exécute en `onRequest`, donc AVANT
 * `authenticate` — `request.tenantId` n'existe pas encore, et se rabattre sur un JWT non
 * vérifié laisserait un attaquant choisir sa propre clé. Surtout, une clé par IP est
 * fausse ici : en Afrique de l'Ouest le CGNAT fait partager une IP à des boutiques sans
 * lien, et les caisses d'un même magasin sortent toutes par la même adresse — un plafond
 * par IP bloque des commerçants légitimes. Ici le tenant vient d'un JWT vérifié (ou de la
 * boucle du cron), donc la clé est exacte.
 */
// ── Repli MÉMOIRE du plafond de rafale ───────────────────────────────────────
// ⚠️ Sans lui, une panne Redis retirerait TOUT plafond par tenant sur les endpoints
// payants : le quota quotidien est fail-open (choix assumé — ne pas couper un client
// payant), et l'override `@fastify/rate-limit` retiré des routes assurait justement ce
// filet grâce à son store mémoire. On le rétablit ici, mais keyé par TENANT et non par
// IP (le CGNAT ouest-africain fait partager une IP à des boutiques sans lien).
// Portée = ce process (comme le store mémoire de @fastify/rate-limit) : garantie
// identique à celle d'avant, avec une clé juste.
const memBurst = new Map<string, { minute: string; n: number }>()

function memBurstOk(key: string, minute: string, max: number): boolean {
  const cur = memBurst.get(key)
  if (!cur || cur.minute !== minute) {
    memBurst.set(key, { minute, n: 1 })
    if (memBurst.size > 5000) {            // borne mémoire : purge des minutes révolues
      for (const [k, v] of memBurst) if (v.minute !== minute) memBurst.delete(k)
    }
    return true
  }
  if (cur.n >= max) return false
  cur.n++
  return true
}

async function burstOk(tenantId: string, kind: SpendKind): Promise<boolean> {
  const max = burstMax()
  if (max <= 0) return true // désactivé explicitement par l'exploitant
  const minute = new Date().toISOString().slice(0, 16) // AAAA-MM-JJTHH:MM
  const key = `burst:${kind}:${tenantId}:${minute}`

  if (!redis) return memBurstOk(key, minute, max)

  try {
    // ⚠️ Compte des OPÉRATIONS, pas des unités : une campagne légitime de 500
    // destinataires est UNE opération (elle reste bornée par le quota quotidien).
    const n = await redis.incrby(key, 1)
    if (n === 1) await redis.expire(key, 120)
    if (n > max) {
      await redis.decrby(key, 1).catch(() => {})
      return false
    }
    return true
  } catch {
    return memBurstOk(key, minute, max) // Redis KO → filet mémoire, jamais « tout ouvert »
  }
}

/**
 * Rend des unités réservées mais finalement NON consommées (envoi partiel/échoué).
 *
 * ⚠️ `key` DOIT être celle rendue par la réservation. Recalculer `quotaKey()` ici
 * viserait la clé du jour COURANT : une réservation faite à 23h59 et libérée à 00h01
 * décrémentait le compteur du LENDEMAIN, offrant N unités gratuites au tenant. Le repli
 * sur le calcul reste pour les appels historiques, mais tous les appelants passent la clé.
 */
export async function releaseQuota(tenantId: string, kind: SpendKind, units: number, key?: string): Promise<void> {
  if (!redis || units <= 0) return
  const target = key ?? quotaKey(tenantId, kind)
  try {
    await redis.decrby(target, units)
    await redis.expire(target, QUOTA_TTL) // si le DECRBY vient de créer la clé, elle expire quand même
  } catch { /* au pire l'unité reste comptée */ }
}

/**
 * Point d'entrée UNIQUE. Appelé par les clients gardés, jamais par un handler
 * directement — c'est ce qui garantit qu'aucun chemin de dépense ne l'oublie.
 */
export async function authorizeSpend(
  tenantId: string | null | undefined,
  kind: SpendKind,
  units = 1,
  opts?: {
    /**
     * Exempte CET appel du plafond minute (`burstOk`). Réservé au reçu de vente
     * AUTOMATIQUE : une caisse en heure de pointe enchaîne > 10 ventes/min et chaque
     * vente déclenche son reçu — la rafale coupait le 11ᵉ. Le plafond JOURNALIER borne
     * toujours ; l'exemption ne lève QUE la minute. Tout le reste (send-ticket manuel,
     * diffusions, campagnes) y reste soumis.
     */
    skipBurst?: boolean
  },
): Promise<SpendDecision> {
  const deny = (code: string, message: string): SpendDecision =>
    ({ ok: false, code, message, used: 0, limit: 0, remaining: 0 })

  if (!tenantId) return deny(TENANT_INACTIVE, 'Aucune boutique active')
  if (units <= 0) return { ok: true, used: 0, limit: 0, degraded: false }

  let info: TenantSpendInfo | null
  try {
    info = await resolveTenantSpendInfo(tenantId)
  } catch {
    return deny(TENANT_INACTIVE, 'Statut de la boutique indéterminable') // fail-closed
  }

  const state = tenantSpendState(info)
  if (!state.ok) return deny(state.code!, state.message!)

  if (!opts?.skipBurst && !(await burstOk(tenantId, kind))) {
    return deny(BURST_EXCEEDED, 'Trop de demandes en une minute pour cette boutique. Réessayez dans un instant.')
  }

  return reserveQuota(tenantId, kind, units, info!.status)
}
