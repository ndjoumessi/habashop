import { Resend } from 'resend'
import { authorizeSpend } from './spendGuard'

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
    console.log('📧 Email envoyé:', opts.subject, '→', opts.to)
    return true
  } catch (err: unknown) {
    console.error('❌ Email échoué:', err)
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
