import AfricasTalking from 'africastalking'
import { authorizeSpend, releaseQuota } from './spendGuard'
import { redactError } from '../redactPhone'
import { resolveRecipient, type PhoneOwner, type PhoneRefusal } from './recipientPhone'

/**
 * SEUL module autorisé à instancier le SDK Africa's Talking (SMS facturé).
 *
 * Même goulot que twilioClient : verrouillé par `spendGuardAllowlist.test.ts` — tout
 * `import 'africastalking'` ailleurs dans `src/` fait échouer les tests. Sans ce goulot,
 * le prochain handler contourne la garde de dépense.
 *
 * Ne throw JAMAIS : un refus est une VALEUR de retour (contrat fire-and-forget des
 * alertes/crons). MÊME sécurité téléphonique que WhatsApp — un SMS part vers un numéro,
 * donc PASSE PAR `resolveRecipient` (leçon la plus chère du repo : jamais de numéro deviné).
 */

export type SmsResult = {
  sent: number
  denied: boolean
  code?: string
  message?: string
  failed?: number
  /** Destinataires ÉCARTÉS faute d'E.164 certain, avec motif — à surfacer, pas à taire. */
  refused?: { reason: PhoneRefusal; count: number }[]
}

function getClient() {
  const apiKey = (process.env.SMS_API_KEY ?? '').trim()
  // Africa's Talking exige un username (sandbox → 'sandbox'). Défaut 'sandbox' pour le bac à sable.
  const username = (process.env.SMS_USERNAME ?? 'sandbox').trim()
  if (!apiKey) return null
  try { return AfricasTalking({ apiKey, username }) } catch { return null }
}

/** true si la clé SMS est présente (feature activable). */
export function isSmsConfigured(): boolean {
  return !!(process.env.SMS_API_KEY ?? '').trim()
}

/**
 * Envoi SMS GARDÉ (dépense + téléphone). `owner` OBLIGATOIRE, comme sendWhatsApp : le
 * compilateur force chaque appelant à déclarer à qui appartient le numéro (commerçant →
 * normalisable avec son pays ; client → international exigé). Quota réservé pour le nombre
 * RÉEL de destinataires ; les unités des envois échoués/écartés sont rendues.
 */
export async function sendSms(opts: {
  tenantId: string | null | undefined
  to: string | string[]
  message: string
  owner: PhoneOwner
}): Promise<SmsResult> {
  const raw = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter((p) => !!p && String(p).trim())

  // Résolution AVANT réservation : un destinataire écarté ne consomme aucune unité.
  const recipients: string[] = []
  const refusedBy = new Map<PhoneRefusal, number>()
  for (const phone of raw) {
    const r = resolveRecipient(String(phone), opts.owner)
    if (r.status === 'resolved') recipients.push(r.e164)
    else refusedBy.set(r.reason, (refusedBy.get(r.reason) ?? 0) + 1)
  }
  const refused = [...refusedBy].map(([reason, count]) => ({ reason, count }))
  if (refused.length > 0) {
    console.warn('[smsClient] destinataire(s) écarté(s) — E.164 non certain :', JSON.stringify(refused))
  }
  if (recipients.length === 0) {
    return { sent: 0, denied: false, ...(refused.length > 0 ? { refused, code: refused[0].reason } : {}) }
  }

  const decision = await authorizeSpend(opts.tenantId, 'sms', recipients.length)
  if (!decision.ok) return { sent: 0, denied: true, code: decision.code, message: decision.message }
  const reservedKey = decision.quotaKey

  const client = getClient()
  const from = (process.env.SMS_SENDER_ID ?? '').trim() // shortcode/sender id optionnel
  if (!client) {
    await releaseQuota(opts.tenantId!, 'sms', recipients.length, reservedKey)
    console.warn('[smsClient] SMS_API_KEY absente → envoi ignoré')
    // failed = N (ces destinataires n'ont jamais été contactés), pas 0 (compte-rendu honnête).
    return { sent: 0, denied: false, failed: recipients.length, code: 'SMS_NOT_CONFIGURED', ...(refused.length > 0 ? { refused } : {}) }
  }

  let sent = 0
  let failed = 0
  try {
    const res = await client.SMS.send({ to: recipients, message: opts.message, ...(from ? { from } : {}) })
    for (const r of res?.SMSMessageData?.Recipients ?? []) {
      // statusCode AT : 100-102 = accepté/en file ; le reste = échec.
      if (r.statusCode >= 100 && r.statusCode <= 102) sent++
      else failed++
    }
    // Réponse sans détail par destinataire (sandbox parfois) → on considère tout parti.
    if ((res?.SMSMessageData?.Recipients?.length ?? 0) === 0) sent = recipients.length
  } catch (e: unknown) {
    failed = recipients.length
    // ⚠️ Le message d'erreur peut embarquer le numéro → caviardé (CLAUDE.md § PII).
    console.warn('[smsClient] échec envoi (non bloquant):', redactError(e))
  }
  if (failed > 0) await releaseQuota(opts.tenantId!, 'sms', failed, reservedKey)

  return { sent, denied: false, failed, ...(refused.length > 0 ? { refused } : {}) }
}
