import twilio from 'twilio'
import { authorizeSpend, releaseQuota } from './spendGuard'
import { redactError } from '../redactPhone'
import { normalizePhone, requireInternational } from '../phoneE164'

/**
 * SEUL module autorisé à instancier le SDK Twilio.
 *
 * Verrouillé par `spendGuardAllowlist.test.ts` : tout `import twilio` ailleurs dans
 * `src/` fait échouer les tests. Sans ce goulot, le prochain handler contourne la garde
 * — c'est exactement ainsi que le reçu automatique de vente et les crons 20h/8h avaient
 * échappé aux gardes posées route par route.
 *
 * Ne throw JAMAIS : un refus est une VALEUR de retour. Les chemins fire-and-forget
 * (reçu de vente, crons) l'ignorent — une vente ne doit pas échouer parce que l'envoi
 * WhatsApp est refusé — et les routes le mappent en HTTP.
 */

/**
 * À QUI l'on écrit — déterminé par la PROVENANCE du numéro, jamais par l'intention.
 *
 * - `owner`    : numéro lu dans `Tenant.ownerPhone`. Le titulaire est le commerçant,
 *                donc le pays de la boutique est une information sur LUI → normalisable.
 * - `customer` : toute autre provenance (fiche client, corps de requête, liste de
 *                diffusion). Le pays de la boutique n'apprend RIEN sur ce numéro
 *                → jamais normalisé, l'international est EXIGÉ.
 *
 * ⚠️ Champ OBLIGATOIRE, sans valeur par défaut : un défaut silencieux ferait
 * retomber une nouvelle surface d'envoi du mauvais côté sans que personne ne le
 * décide. TypeScript force chaque appelant à trancher.
 */
export type SendAudience = 'owner' | 'customer'

export type SendResult = {
  sent: number
  denied: boolean
  code?: string
  message?: string
  failed?: number
  /**
   * Destinataires ÉCARTÉS avant tout appel Twilio, faute de numéro résolvable en
   * E.164 sûr. Distinct de `failed` (Twilio a refusé) : ici on n'a même pas essayé.
   * Remonté aux routes pour que « rien n'est parti » ne se confonde pas avec un succès.
   */
  skipped?: number
  /** SID Twilio des messages réellement partis (les routes les renvoient au client). */
  sids: string[]
  /**
   * E.164 RÉELLEMENT remis à Twilio, dans l'ordre des envois réussis. Sans ça, une
   * route ne peut plus dire au commerçant vers quel numéro le message est parti —
   * or c'est exactement ce qu'un support rapproche du journal Twilio, et le seul
   * moyen de diagnostiquer une résolution douteuse.
   */
  sentTo: string[]
}

function getClient() {
  const sid = (process.env.TWILIO_ACCOUNT_SID ?? '').trim()
  const token = (process.env.TWILIO_AUTH_TOKEN ?? '').trim()
  if (!sid || !token) return null
  try { return twilio(sid, token) } catch { return null }
}

/** Version du SDK — diagnostic (`/api/whatsapp/debug`), sans dépendance directe ailleurs. */
export function twilioVersion(): string {
  try { return require('twilio/package.json').version } catch { return 'unknown' }
}

/** true si les trois variables Twilio sont présentes (SID, TOKEN, FROM). */
export function isTwilioConfigured(): boolean {
  return !!getClient() && !!(process.env.TWILIO_WHATSAPP_FROM ?? '').trim()
}

/**
 * Met une adresse WhatsApp sur un E.164 DÉJÀ VALIDÉ.
 *
 * ⚠️ N'ajoute plus de `+` à l'aveugle. L'ancienne version le faisait sur n'importe
 * quelle entrée, en s'appuyant sur l'idée qu'un numéro mal formé serait rejeté par
 * Twilio — c'est FAUX : `+622123456` (national guinéen préfixé au hasard) est un
 * numéro INDONÉSIEN valide, donc livré. « On ne normalise pas » n'a jamais voulu
 * dire « on n'envoie pas » ; désormais si, cf. `resolveRecipient`.
 */
function toWhatsAppAddress(e164: string): string {
  return e164.startsWith('whatsapp:') ? e164 : `whatsapp:${e164}`
}

/**
 * Résout un destinataire en E.164 sûr, selon le flux. Renvoie `null` quand aucune
 * résolution certaine n'est possible : l'appelant n'envoie alors RIEN.
 */
function resolveRecipient(phone: string, audience: SendAudience, country: string | null | undefined): string | null {
  const r = audience === 'owner' ? normalizePhone(phone, country) : requireInternational(phone)
  return r.normalized ? r.value : null
}

/**
 * Envoi WhatsApp GARDÉ, à un ou plusieurs destinataires.
 *
 * Le quota est réservé pour le nombre RÉEL de destinataires (pas 1 par requête) : une
 * campagne de N numéros réserve N. Si ça ne rentre pas, tout est refusé — pas de
 * campagne tronquée à mi-cible — et les unités des envois échoués sont rendues.
 */
export async function sendWhatsApp(opts: {
  tenantId: string | null | undefined
  to: string | string[]
  body: string
  /** Voir `SendAudience` — obligatoire, aucun défaut. */
  audience: SendAudience
  kind?: 'whatsapp'
}): Promise<SendResult> {
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(p => !!p && String(p).trim())
  if (recipients.length === 0) return { sent: 0, denied: false, sids: [], sentTo: [] }

  // Pré-check du N COMPLET avant la boucle.
  const decision = await authorizeSpend(opts.tenantId, 'whatsapp', recipients.length)
  if (!decision.ok) {
    return { sent: 0, denied: true, code: decision.code, message: decision.message, sids: [], sentTo: [] }
  }

  const reservedKey = decision.quotaKey // clé du jour de la RÉSERVATION (cf. bascule de minuit)
  const client = getClient()
  const from = (process.env.TWILIO_WHATSAPP_FROM ?? '').trim()
  if (!client || !from) {
    // Rien n'est parti : on rend les unités réservées.
    await releaseQuota(opts.tenantId!, 'whatsapp', recipients.length, reservedKey)
    console.warn('[twilioClient] configuration Twilio incomplète (SID/TOKEN/FROM) → envoi ignoré')
    return { sent: 0, denied: false, code: 'TWILIO_NOT_CONFIGURED', sids: [], sentTo: [] }
  }

  let sent = 0
  let failed = 0
  let skipped = 0
  const sids: string[] = []
  const sentTo: string[] = []
  for (const phone of recipients) {
    // ⚠️ ON N'ENVOIE QU'À UN E.164 QUE L'ON A VALIDÉ. Le flux décide de la méthode :
    // le numéro du commerçant est résolu avec le pays de sa boutique, celui d'un tiers
    // doit déjà être international. Aucune résolution certaine ⇒ aucun envoi.
    const e164 = resolveRecipient(String(phone), opts.audience, decision.country)
    if (!e164) {
      skipped++
      console.warn(`[twilioClient] destinataire écarté (numéro non résolvable en E.164, flux=${opts.audience})`)
      continue
    }
    try {
      const msg = await client.messages.create({ from, to: toWhatsAppAddress(e164), body: opts.body })
      if (msg?.sid) sids.push(msg.sid)
      sentTo.push(e164)
      sent++
    } catch (e: unknown) {
      failed++
      // ⚠️ Le message Twilio embarque le numéro destinataire → caviardé (CLAUDE.md § PII).
      console.warn('[twilioClient] échec envoi (non bloquant):', redactError(e))
    }
  }
  // Le compteur mesure les envois RÉELS : on rend ce qui n'est pas parti, écarté compris.
  const unspent = failed + skipped
  if (unspent > 0) await releaseQuota(opts.tenantId!, 'whatsapp', unspent, reservedKey)

  return { sent, denied: false, failed, skipped, sids, sentTo }
}
