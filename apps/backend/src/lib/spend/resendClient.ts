import { Resend } from 'resend'
import { authorizeSpend } from './spendGuard'
import { redactEmail, redactError } from '../redactPhone'

/**
 * SEUL module autorisé à instancier le SDK Resend.
 *
 * Verrouillé par `spendGuardAllowlist.test.ts`, comme Twilio et Anthropic.
 *
 * ⚠️ DEUX familles d'e-mails, volontairement distinctes :
 *
 *  • `sendTenantEmail` — déclenché par un utilisateur de la boutique ou par un cron
 *    qui travaille POUR elle (invitation, alerte stock, rapport hebdo, récap paie).
 *    C'est ce que peut abuser un compte démo. → GARDÉ (démo / essai échu / quota).
 *
 *  • `sendPlatformEmail` — cycle de vie du SaaS envoyé PAR la plateforme au commerçant
 *    (bienvenue, relances d'essai, essai expiré, confirmation d'abonnement).
 *    ⚠️ EXEMPT du garde, et ce n'est pas un oubli : passer ces envois par
 *    `tenantSpendState` bloquerait précisément l'e-mail « votre essai est terminé »
 *    au moment où le tenant devient `trial` échu ou `suspended` — l'utilisateur ne
 *    serait jamais prévenu de la raison pour laquelle son service s'est arrêté.
 *    Leur volume est borné par la logique des crons, pas par une entrée utilisateur.
 */

// Instancié À L'APPEL (comme les clients Twilio/Anthropic) : une clé posée après le
// démarrage du process est prise en compte, et les tests peuvent la définir eux-mêmes.
function getClient(): Resend | null {
  const key = (process.env.RESEND_API_KEY ?? '').trim()
  return key ? new Resend(key) : null
}

const FROM = () => process.env.EMAIL_FROM || 'HabaShop <onboarding@resend.dev>'

export function isResendConfigured(): boolean {
  return !!getClient()
}

export type MailPayload = { to: string; subject: string; html: string; text?: string }

async function deliver(opts: MailPayload): Promise<boolean> {
  const resend = getClient()
  if (!resend) {
    console.warn('⚠️  RESEND_API_KEY manquant — email non envoyé:', opts.subject)
    return false
  }
  try {
    await resend.emails.send({
      from:    FROM(),
      to:      opts.to,
      subject: opts.subject,
      html:    opts.html,
      text:    opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
    })
    // ⚠️ PII — l'adresse est CAVIARDÉE. Elle partait en clair dans les logs Railway.
    console.log('[resendClient] email envoyé:', opts.subject, '→', redactEmail(opts.to))
    return true
  } catch (err: unknown) {
    // ⚠️ Les erreurs Resend embarquent l'adresse destinataire, comme Twilio le numéro.
    console.error('[resendClient] email échoué:', redactError(err))
    return false
  }
}

/** E-mail opérationnel d'une boutique — GARDÉ (démo, essai échu, suspension, quota). */
export async function sendTenantEmail(tenantId: string | null | undefined, opts: MailPayload): Promise<boolean> {
  const decision = await authorizeSpend(tenantId, 'email', 1)
  if (!decision.ok) {
    console.warn(`[resendClient] email non envoyé (${decision.code}) tenant=${tenantId} — ${opts.subject}`)
    return false
  }
  return deliver(opts)
}

/** E-mail de cycle de vie SaaS — exempt du garde (cf. en-tête du module). */
export async function sendPlatformEmail(opts: MailPayload): Promise<boolean> {
  return deliver(opts)
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE — état RÉEL du compte d'expédition
// ─────────────────────────────────────────────────────────────────────────────
/**
 * ⚠️ CE QU'ON MESURE, ET CE QU'ON A REFUSÉ DE MESURER.
 *
 * Cette sonde a remplacé un panneau de monitoring entièrement SIMULÉ (`ResendMonitor`,
 * supprimé le 2026-08-15 : `Math.random()` toutes les 5 secondes sous un badge « LIVE »).
 * Le geste n'est donc pas « rebrancher ce qu'il y avait » : c'est décider, fait par fait,
 * ce qu'on est capable d'affirmer.
 *
 * ON MESURE — la VÉRIFICATION DU DOMAINE D'EXPÉDITION. C'est le seul fait de ce panneau
 * qui change une décision : tant qu'on expédie depuis `resend.dev` (domaine partagé), la
 * délivrabilité dépend de la réputation d'inconnus, et rien ne relie nos e-mails à
 * HabaShop. L'ancien panneau AFFIRMAIT « Domaine : resend.dev » en littéral — sans savoir
 * si c'était vrai, ni si un domaine propre avait été vérifié entre-temps.
 *
 * ON NE MESURE PAS — le flux des e-mails (`emails.list`, `logs.list`). Ces réponses
 * portent les ADRESSES DES DESTINATAIRES : les relayer vers un navigateur ferait sortir
 * les adresses des clients de nos commerçants vers un écran d'opérateur, pour un
 * bénéfice de diagnostic que le tableau de bord Resend rend déjà. On ne construit pas
 * une surface d'exposition PII pour afficher un chiffre.
 *
 * ⚠️ AUCUN `authorizeSpend` ICI, et ce n'est pas un oubli. Le garde de dépense résout un
 * TENANT ; cette route est plateforme et n'en a aucun. Surtout, elle ne dépense rien :
 * lire la liste des domaines n'émet pas d'e-mail. Ce qu'il faut borner ici, c'est la
 * CADENCE d'appel à l'API tierce — d'où le cache, pas un quota.
 */
export type ResendDomain = { name: string; verified: boolean; statut: string }

export type ResendAccount = {
  /** La clé est-elle posée ? Déclaratif — ne dit rien de sa validité. */
  configured: boolean
  /** Adresse d'expédition effective, telle que `deliver()` l'emploie. */
  expediteur: string | null
  /** Domaine extrait de l'expéditeur. `null` si l'adresse est illisible. */
  domaineExpedition: string | null
  /**
   * ⚠️ TROIS ÉTATS, jamais deux : `true` vérifié · `false` non vérifié · `null` NON
   * CONCLUANT (clé absente, API injoignable, réponse de forme inattendue). Un `false`
   * par défaut affirmerait un fait qu'on n'a pas établi.
   */
  domaineVerifie: boolean | null
  /** Domaines du compte. `null` = on n'a pas pu savoir, JAMAIS `[]` par dépit. */
  domaines: ResendDomain[] | null
  /** Cause de l'absence de mesure, pour que l'écran puisse la DIRE. */
  echec: 'NOT_CONFIGURED' | 'UNREACHABLE' | 'UNEXPECTED_SHAPE' | null
  /** Horodatage serveur de la mesure — « vérifié il y a N s » n'est pas décoratif. */
  mesureA: string
}

/** Domaine d'une adresse, avec ou sans forme « Nom <adresse> ». `null` si illisible. */
export function domaineDe(expediteur: string | null | undefined): string | null {
  if (typeof expediteur !== 'string') return null
  const m = /<([^>]*)>/.exec(expediteur)
  const adresse = (m ? m[1] : expediteur).trim()
  const at = adresse.lastIndexOf('@')
  if (at < 0 || at === adresse.length - 1) return null
  return adresse.slice(at + 1).toLowerCase() || null
}

/**
 * Normalise la réponse de `domains.list()`.
 *
 * ⚠️ DÉFENSIF PAR EXPÉRIENCE, pas par prudence de principe : une réponse TRUTHY sans les
 * clés attendues a déjà rendu un écran BLANC dans ce produit (`txStats.mtn.count`,
 * `pages/Integrations.tsx`). On ne suppose ni `data`, ni un tableau, ni les champs.
 * Une forme inattendue rend `null` — « je ne sais pas » — jamais une liste vide, qui se
 * lirait « aucun domaine » et vaudrait affirmation.
 */
export function lireDomaines(reponse: unknown): ResendDomain[] | null {
  const data = (reponse as { data?: unknown } | null)?.data
  const brut = Array.isArray(data) ? data : Array.isArray((data as { data?: unknown })?.data) ? (data as { data: unknown[] }).data : null
  if (!brut) return null
  const out: ResendDomain[] = []
  for (const d of brut) {
    const o = d as { name?: unknown; status?: unknown }
    if (typeof o?.name !== 'string') return null      // forme inattendue → non concluant
    const statut = typeof o.status === 'string' ? o.status : 'inconnu'
    out.push({ name: o.name, statut, verified: statut === 'verified' })
  }
  return out
}

/** Mémo court : borne la cadence vers l'API tierce, pas un quota de dépense. */
let cache: { a: number; v: ResendAccount } | null = null
const TTL_MS = 60_000

export function invalidateResendAccountCache(): void { cache = null }

export async function resendAccountStatus(maintenant: number = Date.now()): Promise<ResendAccount> {
  if (cache && maintenant - cache.a < TTL_MS) return cache.v

  const expediteur = FROM()
  const domaineExpedition = domaineDe(expediteur)
  const base = { expediteur, domaineExpedition, mesureA: new Date(maintenant).toISOString() }

  const client = getClient()
  if (!client) {
    // ⚠️ Clé absente = fonctionnalité INERTE, jamais une erreur serveur (convention du dépôt).
    const v: ResendAccount = { ...base, configured: false, domaineVerifie: null, domaines: null, echec: 'NOT_CONFIGURED' }
    cache = { a: maintenant, v }
    return v
  }

  let domaines: ResendDomain[] | null = null
  let echec: ResendAccount['echec'] = null
  try {
    domaines = lireDomaines(await client.domains.list())
    if (domaines === null) echec = 'UNEXPECTED_SHAPE'
  } catch (err) {
    // ⚠️ Caviardé : une erreur d'API peut embarquer une adresse.
    console.warn('[resendClient] sonde domaines injoignable:', redactError(err))
    echec = 'UNREACHABLE'
  }

  const v: ResendAccount = {
    ...base,
    configured: true,
    domaines,
    // Non concluant tant qu'on n'a pas la liste : `false` affirmerait « non vérifié ».
    domaineVerifie: domaines === null || domaineExpedition === null
      ? null
      : domaines.some(d => d.name.toLowerCase() === domaineExpedition && d.verified),
    echec,
  }
  cache = { a: maintenant, v }
  return v
}
