import twilio from 'twilio'
import { authorizeSpend, releaseQuota } from './spendGuard'
import { redactError } from '../redactPhone'
import { normalizePhone } from '../phoneE164'

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

export type SendResult = {
  sent: number
  denied: boolean
  code?: string
  message?: string
  failed?: number
  /** SID Twilio des messages réellement partis (les routes les renvoient au client). */
  sids: string[]
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
 * Met le numéro sous la forme attendue par Twilio (`whatsapp:+…`).
 *
 * ⚠️ Ne DEVINE rien : la mise en E.164 est faite en amont par `normalizePhone`, qui
 * rend le numéro inchangé dès que le pays est inconnu. Ici, un numéro resté national
 * reçoit un `+` qui ne le rend pas valide pour autant — Twilio le rejette, ce qui est
 * l'issue voulue (cf. l'invariant de `lib/phoneE164.ts`).
 */
function toWhatsAppAddress(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '').replace(/^00/, '+')
  return cleaned.startsWith('whatsapp:') ? cleaned : `whatsapp:${cleaned.startsWith('+') ? cleaned : '+' + cleaned}`
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
  kind?: 'whatsapp'
}): Promise<SendResult> {
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(p => !!p && String(p).trim())
  if (recipients.length === 0) return { sent: 0, denied: false, sids: [] }

  // Pré-check du N COMPLET avant la boucle.
  const decision = await authorizeSpend(opts.tenantId, 'whatsapp', recipients.length)
  if (!decision.ok) {
    return { sent: 0, denied: true, code: decision.code, message: decision.message, sids: [] }
  }

  const reservedKey = decision.quotaKey // clé du jour de la RÉSERVATION (cf. bascule de minuit)
  const client = getClient()
  const from = (process.env.TWILIO_WHATSAPP_FROM ?? '').trim()
  if (!client || !from) {
    // Rien n'est parti : on rend les unités réservées.
    await releaseQuota(opts.tenantId!, 'whatsapp', recipients.length, reservedKey)
    console.warn('[twilioClient] configuration Twilio incomplète (SID/TOKEN/FROM) → envoi ignoré')
    return { sent: 0, denied: false, code: 'TWILIO_NOT_CONFIGURED', sids: [] }
  }

  let sent = 0
  let failed = 0
  const sids: string[] = []
  for (const phone of recipients) {
    try {
      // Normalisation E.164 au POINT D'ENVOI : tous les appelants (reçu de vente, crons,
      // routes) en bénéficient sans câbler le pays un par un. Pays inconnu ⇒ numéro
      // INCHANGÉ, jamais réécrit au hasard (cf. `lib/phoneE164.ts`).
      const e164 = normalizePhone(String(phone), decision.country).value
      const msg = await client.messages.create({ from, to: toWhatsAppAddress(e164), body: opts.body })
      if (msg?.sid) sids.push(msg.sid)
      sent++
    } catch (e: unknown) {
      failed++
      // ⚠️ Le message Twilio embarque le numéro destinataire → caviardé (CLAUDE.md § PII).
      console.warn('[twilioClient] échec envoi (non bloquant):', redactError(e))
    }
  }
  // Le compteur mesure les envois RÉELS : on rend ce qui n'est pas parti.
  if (failed > 0) await releaseQuota(opts.tenantId!, 'whatsapp', failed, reservedKey)

  return { sent, denied: false, failed, sids }
}
