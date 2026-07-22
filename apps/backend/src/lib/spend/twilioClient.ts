import twilio from 'twilio'
import { authorizeSpend, releaseQuota } from './spendGuard'

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

function normalize(phone: string): string {
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

  const client = getClient()
  const from = (process.env.TWILIO_WHATSAPP_FROM ?? '').trim()
  if (!client || !from) {
    // Rien n'est parti : on rend les unités réservées.
    await releaseQuota(opts.tenantId!, 'whatsapp', recipients.length)
    console.warn('[twilioClient] configuration Twilio incomplète (SID/TOKEN/FROM) → envoi ignoré')
    return { sent: 0, denied: false, code: 'TWILIO_NOT_CONFIGURED', sids: [] }
  }

  let sent = 0
  let failed = 0
  const sids: string[] = []
  for (const phone of recipients) {
    try {
      const msg = await client.messages.create({ from, to: normalize(String(phone)), body: opts.body })
      if (msg?.sid) sids.push(msg.sid)
      sent++
    } catch (e: any) {
      failed++
      console.warn('[twilioClient] échec envoi (non bloquant):', e?.message ?? e)
    }
  }
  // Le compteur mesure les envois RÉELS : on rend ce qui n'est pas parti.
  if (failed > 0) await releaseQuota(opts.tenantId!, 'whatsapp', failed)

  return { sent, denied: false, failed, sids }
}
