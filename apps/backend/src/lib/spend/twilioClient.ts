import twilio from 'twilio'
import { authorizeSpend, releaseQuota } from './spendGuard'
import { toWhatsAppAddress, maskPhone } from './phone'

/**
 * SEUL module autorisé à instancier le SDK Twilio.
 *
 * Verrouillé par `spendGuardAllowlist.test.ts` : tout `import twilio` ailleurs dans
 * `src/` fait échouer les tests. Sans ce goulot, le prochain handler contourne la garde
 * — c'est ainsi que le reçu automatique de vente et les crons 20h/8h avaient échappé
 * aux gardes posées route par route.
 *
 * ⚠️ Le client REMONTE tout ce que les routes savaient distinguer avant d'être unifiées :
 * envoyés, échoués, non-contactés, code d'erreur Twilio, et le détail PAR DESTINATAIRE.
 * La première version aplatissait tout en `{sent, denied}` : une campagne vers 180 numéros
 * avec Twilio non configuré renvoyait `failed: 0`, et la table de messages d'erreur Twilio
 * des routes devenait du code mort. Un goulot ne doit pas être un entonnoir à information.
 *
 * Ne throw JAMAIS : un refus est une VALEUR de retour. Les chemins fire-and-forget
 * (reçu de vente, crons) l'ignorent, les routes le mappent en HTTP.
 */

export type RecipientOutcome = {
  /** Numéro normalisé E.164 (ou la valeur brute si elle était inexploitable). */
  to: string
  ok: boolean
  /** Code d'erreur Twilio (21211, 21608, 20003…) — permet aux routes de le mapper. */
  errorCode?: number
  /** Message Twilio, MASQUÉ (aucun numéro en clair). */
  error?: string
  sid?: string
}

export type SendResult = {
  sent: number
  /** Destinataires en échec, y compris ceux jamais contactés (voir `skipped`). */
  failed: number
  /** Jamais contactés : Twilio non configuré, ou numéro inexploitable. Inclus dans `failed`. */
  skipped: number
  denied: boolean
  code?: string
  message?: string
  sids: string[]
  /** Détail par destinataire — ce qui permet aux routes de rester précises. */
  results: RecipientOutcome[]
  /** Premier code d'erreur Twilio rencontré (raccourci pour les envois unitaires). */
  errorCode?: number
  /** Unités encore disponibles aujourd'hui quand le refus vient du quota. */
  remaining?: number
}

function getClient() {
  const sid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim()
  const token = (process.env.TWILIO_AUTH_TOKEN ?? '').trim()
  if (!sid || !token) return null
  try { return twilio(sid, token) } catch { return null }
}

/** Version du SDK — diagnostic (`/api/whatsapp/test`), sans dépendance directe ailleurs. */
export function twilioVersion(): string {
  try { return require('twilio/package.json').version } catch { return 'unknown' }
}

/** true si les trois variables Twilio sont présentes (SID, TOKEN, FROM). */
export function isTwilioConfigured(): boolean {
  return !!getClient() && !!(process.env.TWILIO_WHATSAPP_FROM ?? '').trim()
}

export const TWILIO_NOT_CONFIGURED = 'TWILIO_NOT_CONFIGURED'
export const INVALID_NUMBER = 'INVALID_NUMBER'

function empty(over: Partial<SendResult> = {}): SendResult {
  return { sent: 0, failed: 0, skipped: 0, denied: false, sids: [], results: [], ...over }
}

/**
 * Envoi WhatsApp GARDÉ, à un ou plusieurs destinataires.
 *
 * Le quota est réservé pour le nombre RÉEL de destinataires : une campagne de N numéros
 * réserve N. Si ça ne rentre pas, tout est refusé — pas de campagne tronquée à mi-cible —
 * et les unités des envois non aboutis sont rendues sur la clé du jour de la RÉSERVATION.
 */
export async function sendWhatsApp(opts: {
  tenantId: string | null | undefined
  to: string | string[]
  body: string
  /** Pays de la boutique (`Tenant.country`) — indicatif par défaut des numéros nationaux. */
  country?: string
  /** Seau de quota : 'whatsapp' = transactionnel (défaut), 'marketing' = diffusion/campagne. */
  kind?: 'whatsapp' | 'marketing'
  /** `false` pour un envoi transactionnel déclenché par une vente (pas de plafond minute). */
  burst?: boolean
}): Promise<SendResult> {
  const raw = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(p => !!p && String(p).trim())
  if (raw.length === 0) return empty()

  // Normalisation UNIQUE pour tous les appelants (broadcast, campagne, reçu, crons).
  const addressed = raw.map(p => ({ raw: String(p), addr: toWhatsAppAddress(p, opts.country) }))
  const deliverable = addressed.filter(a => a.addr)
  const invalid = addressed.filter(a => !a.addr)

  if (deliverable.length === 0) {
    return empty({
      failed: invalid.length, skipped: invalid.length, code: INVALID_NUMBER,
      results: invalid.map(a => ({ to: a.raw, ok: false, error: 'Numéro inexploitable' })),
    })
  }

  // Pré-check du N COMPLET (des seuls numéros exploitables) avant la boucle.
  const kind = opts.kind ?? 'whatsapp'
  const decision = await authorizeSpend(opts.tenantId, kind, deliverable.length, { burst: opts.burst })
  if (!decision.ok) {
    return empty({
      denied: true, code: decision.code, message: decision.message, remaining: decision.remaining,
      failed: raw.length, skipped: raw.length,
      results: addressed.map(a => ({ to: a.addr ?? a.raw, ok: false, error: decision.message })),
    })
  }

  const reservedKey = decision.quotaKey // clé du jour de la RÉSERVATION (cf. bascule de minuit)
  const client = getClient()
  const from = (process.env.TWILIO_WHATSAPP_FROM ?? '').trim()

  if (!client || !from) {
    // ⚠️ Ces destinataires n'ont JAMAIS été contactés → ils comptent comme échecs.
    // La première version renvoyait `failed: 0`, ce qui faisait apparaître une campagne
    // de 180 numéros comme réussie et sans erreur dans l'historique.
    await releaseQuota(opts.tenantId!, kind, deliverable.length, reservedKey)
    console.warn('[twilioClient] configuration Twilio incomplète (SID/TOKEN/FROM) → aucun envoi')
    return empty({
      failed: raw.length, skipped: raw.length, code: TWILIO_NOT_CONFIGURED,
      results: addressed.map(a => ({ to: a.addr ?? a.raw, ok: false, error: 'Service WhatsApp non configuré' })),
    })
  }

  const results: RecipientOutcome[] = invalid.map(a => ({ to: a.raw, ok: false, error: 'Numéro inexploitable' }))
  const sids: string[] = []
  let sent = 0
  let failedSends = 0

  for (const { addr } of deliverable) {
    try {
      const msg = await client.messages.create({ from, to: addr!, body: opts.body })
      if (msg?.sid) sids.push(msg.sid)
      sent++
      results.push({ to: addr!, ok: true, sid: msg?.sid })
    } catch (e: unknown) {
      failedSends++
      const err = e as { code?: number; message?: string }
      // ⚠️ Le message Twilio contient le numéro destinataire → masqué avant journalisation
      // (CLAUDE.md : aucun numéro de téléphone dans les logs Railway).
      const safe = maskPhone(err?.message ?? String(e))
      console.warn(`[twilioClient] échec envoi (non bloquant) code=${err?.code ?? '?'} — ${safe}`)
      results.push({ to: addr!, ok: false, errorCode: err?.code, error: safe })
    }
  }

  // Le compteur mesure les envois RÉELS : on rend ce qui n'est pas parti.
  if (failedSends > 0) await releaseQuota(opts.tenantId!, kind, failedSends, reservedKey)

  return {
    sent,
    failed: failedSends + invalid.length,
    skipped: invalid.length,
    denied: false,
    sids,
    results,
    errorCode: results.find(r => !r.ok && r.errorCode)?.errorCode,
  }
}
