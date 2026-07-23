import twilio from 'twilio'
import { authorizeSpend, releaseQuota } from './spendGuard'
import { redactError } from '../redactPhone'
import { resolveRecipient, type PhoneOwner, type PhoneRefusal } from './recipientPhone'

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
  /**
   * Destinataires ÉCARTÉS faute d'E.164 certain, avec le motif. Non silencieux :
   * les appelants doivent le surfacer (« reçu non envoyé — numéro pas au format
   * international »), pas seulement le tracer. Un refus muet redonne au commerçant
   * l'illusion que le message est parti.
   */
  refused?: { reason: PhoneRefusal; count: number }[]
  /**
   * Codes d'erreur Twilio des envois ÉCHOUÉS, dans l'ordre. Remontés par la VALEUR
   * de retour et non par exception : `sendWhatsApp` ne throw jamais (contrat
   * fire-and-forget dont dépendent le reçu de vente et les crons). Sans eux, la
   * table `TWILIO_ERRORS` vivait dans un `catch` mort et le caissier recevait un
   * 503 générique au lieu de « Ce numéro n'est pas inscrit sur WhatsApp ».
   */
  errorCodes?: number[]
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
 * Préfixe le canal. Ne transforme PLUS le numéro : la résolution en E.164 est faite
 * en amont par `resolveRecipient`, seule autorité. L'ancienne version collait un `+`
 * à l'aveugle et réécrivait `00` → `+` — deux gestes qui fabriquent un numéro VALIDE
 * d'un autre pays, donc livrable (mesuré : `621234567` → `+621234567`, Indonésie).
 */
function toWhatsAppChannel(e164: string): string {
  return e164.startsWith('whatsapp:') ? e164 : `whatsapp:${e164}`
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
  /**
   * À QUI APPARTIENT LE NUMÉRO. Obligatoire et SANS défaut : le compilateur force
   * chaque appelant à le déclarer. Un défaut permissif rejouerait exactement les
   * quatre fuites précédentes, où un flux client empruntait la logique commerçant.
   */
  owner: PhoneOwner
  kind?: 'whatsapp'
}): Promise<SendResult> {
  const raw = (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(p => !!p && String(p).trim())

  // ── Résolution AVANT toute réservation de quota : un destinataire écarté ne doit
  //    ni consommer d'unité, ni en faire rendre une ensuite. ──
  const recipients: string[] = []
  const refusedBy = new Map<PhoneRefusal, number>()
  for (const phone of raw) {
    const r = resolveRecipient(String(phone), opts.owner)
    if (r.status === 'resolved') recipients.push(r.e164)
    else refusedBy.set(r.reason, (refusedBy.get(r.reason) ?? 0) + 1)
  }
  const refused = [...refusedBy].map(([reason, count]) => ({ reason, count }))
  if (refused.length > 0) {
    // Tracé sans PII : le motif et le compte, jamais le numéro (CLAUDE.md § PII).
    console.warn('[twilioClient] destinataire(s) écarté(s) — E.164 non certain :', JSON.stringify(refused))
  }

  if (recipients.length === 0) {
    return {
      sent: 0,
      denied: false,
      sids: [],
      ...(refused.length > 0 ? { refused, code: refused[0].reason } : {}),
    }
  }

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
    // `failed: recipients.length` et non l'absence de clé : ces N destinataires
    // n'ont JAMAIS été contactés. Rendre `failed: 0` faisait dire à une diffusion
    // de 20 qu'aucun envoi n'avait échoué — un compte-rendu qui ment par omission.
    return {
      sent: 0, denied: false, failed: recipients.length,
      code: 'TWILIO_NOT_CONFIGURED', sids: [],
      ...(refused.length > 0 ? { refused } : {}),
    }
  }

  let sent = 0
  let failed = 0
  const sids: string[] = []
  const errorCodes: number[] = []
  for (const phone of recipients) {
    try {
      const msg = await client.messages.create({ from, to: toWhatsAppChannel(phone), body: opts.body })
      if (msg?.sid) sids.push(msg.sid)
      sent++
    } catch (e: unknown) {
      failed++
      // Le CODE est une donnée technique (pas de PII) : on le remonte pour que
      // l'appelant puisse afficher un motif actionnable.
      const code = Number((e as { code?: unknown })?.code)
      if (Number.isFinite(code)) errorCodes.push(code)
      // ⚠️ Le message Twilio embarque le numéro destinataire → caviardé (CLAUDE.md § PII).
      console.warn('[twilioClient] échec envoi (non bloquant):', redactError(e))
    }
  }
  // Le compteur mesure les envois RÉELS : on rend ce qui n'est pas parti.
  if (failed > 0) await releaseQuota(opts.tenantId!, 'whatsapp', failed, reservedKey)

  return {
    sent, denied: false, failed, sids,
    ...(refused.length > 0 ? { refused } : {}),
    ...(errorCodes.length > 0 ? { errorCodes } : {}),
  }
}
