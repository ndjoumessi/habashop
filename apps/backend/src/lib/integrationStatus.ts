/**
 * ÉTAT RÉEL DES INTÉGRATIONS COMMERÇANT — dérivé de l'environnement, jamais déclaré.
 *
 * ─── LE DÉFAUT QU'ON FERME ───────────────────────────────────────────────────
 * MESURÉ le 2026-08-06 : `pages/Integrations.tsx` portait `status:'connected'` en
 * LITTÉRAL sur 11 des 12 intégrations. Le commerçant lisait « connectées » en vert,
 * bande de statut verte comprise, sur des prestataires dont aucun secret n'est posé.
 * Seul PayDunya dérivait son état d'un appel réel (`/api/payments/paydunya/config`).
 *
 * C'est exactement la pastille de santé de la console Ops, un écran plus loin : une
 * couleur qui ne peut pas rougir ne prouve rien. La parade est la même — SONDER là où
 * c'est possible, rester NEUTRE ailleurs, et le DIRE.
 *
 * ─── POURQUOI CE MODULE PLUTÔT QU'UNE SONDE RÉSEAU ───────────────────────────
 * Un ping sur `api.twilio.com` prouve que le host d'un tiers répond — pas que NOTRE
 * compte est configuré. La question du commerçant n'est pas « Twilio est-il debout ? »
 * mais « mes reçus WhatsApp partent-ils ? ». La réponse est dans l'environnement du
 * serveur, et `providerMode()` en est déjà l'autorité pour les paiements. On la réutilise
 * au lieu d'en écrire une seconde (§ Le JUMEAU NON TRAITÉ).
 *
 * ⚠️ On ne renvoie JAMAIS le nom des variables manquantes à ce client : `notConfiguredBody`
 * les nomme côté serveur pour le journal, l'écran commerçant n'en a pas l'usage.
 *
 * ⚠️ `env` est injectable et lu À L'APPEL — jamais figé en constante de module, sinon les
 * tests qui pilotent `process.env` deviennent inopérants (convention du dépôt).
 */

import { providerMode, type ProviderId } from './payments/providerConfig'

/** Intégrations visibles par le COMMERÇANT (paiements + canaux). */
export type MerchantIntegrationId = 'twilio' | 'resend' | 'mtnmomo' | 'campay' | 'paydunya'

/**
 * TROIS états, et la distinction est tout l'objet du module :
 *
 *   live          secrets présents ET environnement de production → encaisse pour de vrai
 *   sandbox       secrets présents, environnement de test         → rien n'est encaissé
 *   unconfigured  secrets absents                                 → l'intégration est inerte
 *
 * ⚠️ `sandbox` n'est PAS une nuance cosmétique de `live` : c'est la différence entre un
 * paiement encaissé et un paiement simulé. Les fondre ferait afficher « connecté » à un
 * commerçant dont aucune vente ne sera jamais créditée.
 */
export type IntegrationState = 'live' | 'sandbox' | 'unconfigured'

/** Un canal (Twilio, Resend) n'a pas de bac à sable : il envoie, ou il est inerte. */
const channelState = (configured: boolean): IntegrationState => configured ? 'live' : 'unconfigured'

/**
 * Un prestataire de paiement : secrets d'abord, environnement ensuite.
 * `providerMode` rend `'live'` dès que les secrets sont là — ce qui ne dit RIEN de
 * l'environnement visé. D'où le second étage.
 */
function paymentState(
  provider: ProviderId,
  env: NodeJS.ProcessEnv,
  isProduction: (env: NodeJS.ProcessEnv) => boolean,
): IntegrationState {
  const { mode } = providerMode(provider, env)
  if (mode === 'unconfigured') return 'unconfigured'
  // `simulated` (artefact hors production) n'est pas un encaissement : c'est du bac à sable.
  if (mode === 'simulated') return 'sandbox'
  return isProduction(env) ? 'live' : 'sandbox'
}

const present = (v: string | undefined): boolean => typeof v === 'string' && v.trim().length > 0

/**
 * État de chaque intégration commerçant, dérivé de l'environnement serveur.
 *
 * ⚠️ Les noms d'environnement sont ceux que les services LISENT réellement
 * (`services/mtnMomo.ts:4`, `services/campay.ts:4`, `services/paydunya.ts:9`) — les
 * recopier de mémoire ferait diverger l'affichage du comportement, et c'est précisément
 * ce genre d'écart qui a produit deux `normalizeCameroonPhone` homonymes.
 */
export function integrationStates(
  env: NodeJS.ProcessEnv = process.env,
): Record<MerchantIntegrationId, IntegrationState> {
  return {
    // Canaux — présence des secrets, pas de notion de bac à sable.
    twilio: channelState(
      present(env.TWILIO_ACCOUNT_SID) && present(env.TWILIO_AUTH_TOKEN) && present(env.TWILIO_WHATSAPP_FROM),
    ),
    resend: channelState(present(env.RESEND_API_KEY)),

    // Paiements — secrets via `providerMode`, puis environnement visé.
    mtnmomo:  paymentState('mtn_momo', env, e => e.MTN_MOMO_ENVIRONMENT === 'production'),
    campay:   paymentState('campay',   env, e => e.CAMPAY_ENVIRONMENT === 'production'),
    paydunya: paymentState('paydunya', env, e => e.PAYDUNYA_MODE === 'live'),
  }
}
