/**
 * CONFIGURATION DES PRESTATAIRES DE PAIEMENT — un secret absent échoue FERMÉ.
 *
 * ⚠️ LE DÉFAUT QU'ON FERME (mesuré le 2026-08-06 sur Railway) : `WAVE_API_KEY` et
 * `ORANGE_CLIENT_ID` sont ABSENTES en production, et les services répondaient alors par un
 * artefact CRÉDIBLE — `https://sandbox.wave.com/pay/<ref>`, `https://sandbox.orangemoney.com/
 * pay/<ref>`. Le commerçant obtenait un lien qui ressemble à un lien de paiement, une
 * `PlanRequest` en `pending_payment` était créée, et rien ne pouvait jamais l'honorer :
 * le webhook, lui, est fail-CLOSED. C'était l'aller qui ne l'était pas.
 *
 * Depuis l'alignement tarifaire, `starter` est le plan par défaut de TOUTE inscription et
 * il est achetable : ce chemin est devenu le chemin PRINCIPAL du produit.
 *
 * Pire encore, et corrigé ici : `verifyWavePayment` et `verifyOMPayment` renvoyaient
 * `paid: true` sans clé. Ce n'est pas un lien mort, c'est une CONFIRMATION DE PAIEMENT
 * fabriquée. Ces deux fonctions n'ont aujourd'hui aucun appelant — c'est un pistolet
 * chargé posé sur la table, pas une faille active, et on décharge le pistolet.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TROIS ÉTATS, ET LA DISTINCTION EST TOUT L'OBJET DU MODULE
 *
 *   live          secrets présents                      → appel réel
 *   simulated     secrets absents MAIS opt-in EXPLICITE → artefact simulé, hors prod
 *   unconfigured  secrets absents, rien d'explicite     → REFUS (PaymentNotConfiguredError)
 *
 * Avant, « sandbox volontaire » et « secret oublié » produisaient exactement la même
 * chose. Un accident doit se voir ; une intention doit s'écrire.
 *
 * ⚠️ `simulated` est INTERDIT en production, même avec le drapeau. C'est la transposition
 * de la règle déjà écrite pour l'auto-approbation (« `IS_SANDBOX` OK pour URL/devise,
 * INTERDIT pour auto-approbation ») : un lien de paiement fabriqué est de la même famille
 * — il fait croire qu'un encaissement est en cours alors qu'aucun ne l'est.
 *
 * ⚠️ L'environnement est lu À L'APPEL, jamais figé en constante de module : une constante
 * rendrait les tests qui pilotent `process.env` inopérants (convention du dépôt, cf. le
 * flag inline des `_SANDBOX_AUTO_SUCCESS`).
 */

import type { MsisdnPolicy } from '../msisdn'

export type ProviderId = 'wave' | 'orange_money' | 'mtn_momo' | 'campay' | 'paydunya'

export type ProviderMode = 'live' | 'simulated' | 'unconfigured'

/**
 * Refus de service : le prestataire n'est pas configuré.
 * Les routes le traduisent en **422 PAYMENT_NOT_CONFIGURED** — le même traitement que le
 * 422 PLAN_QUOTE_ONLY d'Enterprise, et pour la même raison : ce n'est pas une panne
 * (502/503, que le client réessaiera) mais un état produit à énoncer.
 */
export class PaymentNotConfiguredError extends Error {
  readonly code = 'PAYMENT_NOT_CONFIGURED' as const
  constructor(readonly provider: ProviderId, readonly missing: readonly string[]) {
    // ⚠️ On nomme les VARIABLES manquantes, jamais leur valeur.
    super(`Prestataire ${provider} non configuré (variables absentes : ${missing.join(', ') || '—'})`)
    this.name = 'PaymentNotConfiguredError'
  }
}

export interface ProviderSpec {
  /** Variables sans lesquelles aucun appel réel n'est possible. */
  readonly secrets: readonly string[]
  /**
   * Variable d'opt-in explicite autorisant un artefact SIMULÉ hors production.
   * `null` = ce prestataire n'a pas de mode simulé du tout : sans secret, il refuse.
   */
  readonly sandboxFlag: string | null
}

/**
 * Registre — source unique consommée par les services ET par le verrou
 * `paymentProviderConfig.test.ts`. Le verrou énumère CE registre : ajouter un
 * prestataire sans l'y déclarer fait échouer l'assertion de couverture.
 *
 * `sandboxFlag: null` pour MTN, Campay et PayDunya : ils n'ont JAMAIS fabriqué de lien
 * (ils levaient, ou refusaient en 503). On ne leur ouvre pas une porte qui n'existait pas.
 */
export const PAYMENT_PROVIDERS: Readonly<Record<ProviderId, ProviderSpec>> = {
  wave: {
    secrets: ['WAVE_API_KEY'],
    sandboxFlag: 'WAVE_SANDBOX_LINKS',
  },
  orange_money: {
    secrets: ['ORANGE_CLIENT_ID', 'ORANGE_CLIENT_SECRET'],
    sandboxFlag: 'ORANGE_SANDBOX_LINKS',
  },
  mtn_momo: {
    secrets: ['MTN_MOMO_SUBSCRIPTION_KEY', 'MTN_MOMO_USER_ID', 'MTN_MOMO_API_KEY'],
    sandboxFlag: null,
  },
  campay: {
    // Campay accepte DEUX authentifications : un jeton statique, ou un couple
    // identifiant/mot de passe. D'où la résolution particulière ci-dessous.
    secrets: ['CAMPAY_TOKEN', 'CAMPAY_USERNAME', 'CAMPAY_PASSWORD'],
    sandboxFlag: null,
  },
  paydunya: {
    secrets: ['PAYDUNYA_MASTER_KEY', 'PAYDUNYA_PRIVATE_KEY', 'PAYDUNYA_PUBLIC_KEY', 'PAYDUNYA_TOKEN'],
    sandboxFlag: null,
  },
}

/** Une variable vide ou blanche vaut absente — `''` n'est pas un secret. */
const present = (v: string | undefined): boolean => typeof v === 'string' && v.trim().length > 0

/**
 * Variables manquantes pour ce prestataire.
 * Campay est le seul cas non trivial : `CAMPAY_TOKEN` OU (`USERNAME` ET `PASSWORD`).
 */
export function missingSecrets(provider: ProviderId, env: NodeJS.ProcessEnv = process.env): string[] {
  if (provider === 'campay') {
    if (present(env.CAMPAY_TOKEN)) return []
    if (present(env.CAMPAY_USERNAME) && present(env.CAMPAY_PASSWORD)) return []
    return ['CAMPAY_TOKEN', 'CAMPAY_USERNAME', 'CAMPAY_PASSWORD']
  }
  return PAYMENT_PROVIDERS[provider].secrets.filter(k => !present(env[k]))
}

/**
 * Décision PURE — testable sans réseau ni base.
 * `env` injectable : aucune lecture figée au chargement du module.
 */
export function providerMode(
  provider: ProviderId,
  env: NodeJS.ProcessEnv = process.env,
): { mode: ProviderMode; missing: string[] } {
  const missing = missingSecrets(provider, env)
  if (missing.length === 0) return { mode: 'live', missing }

  const flag = PAYMENT_PROVIDERS[provider].sandboxFlag
  const optedIn = flag !== null && env[flag] === '1'
  // ⚠️ L'opt-in ne survit PAS à la production. Un artefact simulé y serait indiscernable
  // d'un vrai lien pour le commerçant qui le reçoit.
  const inProduction = env.NODE_ENV === 'production'

  return { mode: optedIn && !inProduction ? 'simulated' : 'unconfigured', missing }
}

/**
 * Lève si le prestataire ne peut rien faire de réel ni de simulé.
 * Rend le mode retenu sinon — l'appelant branche dessus.
 */
export function requireProvider(
  provider: ProviderId,
  env: NodeJS.ProcessEnv = process.env,
): Exclude<ProviderMode, 'unconfigured'> {
  const { mode, missing } = providerMode(provider, env)
  if (mode === 'unconfigured') throw new PaymentNotConfiguredError(provider, missing)
  return mode
}

/**
 * Vrai si l'erreur est un refus de configuration (mappage 422 des routes).
 *
 * ⚠️ STRUCTUREL, pas `instanceof` — et ce n'est pas de la coquetterie : dès que le module
 * existe en deux exemplaires (transpilation `dist/` vs `src/`, `vi.resetModules()`, deux
 * copies dans un même bundle), `instanceof` rend FAUX sur une erreur pourtant légitime, et
 * la route retombe alors sur le 500/502 générique — exactement le comportement qu'on
 * corrige. Vu au premier tir de `paymentProviderConfig.test.ts`.
 */
export function isNotConfigured(err: unknown): err is PaymentNotConfiguredError {
  return (
    typeof err === 'object' && err !== null &&
    (err as { code?: unknown }).code === 'PAYMENT_NOT_CONFIGURED'
  )
}

/** Corps de réponse unique des routes — même forme que QUOTE_ONLY_BODY. */
export function notConfiguredBody(provider: ProviderId) {
  return {
    error: "Le paiement en ligne n'est pas encore actif pour ce moyen de paiement. Contactez-nous pour finaliser votre abonnement.",
    code: 'PAYMENT_NOT_CONFIGURED' as const,
    provider,
    contactEmail: 'contact@habashop.com',
  }
}

/**
 * Refus d'un numéro irrécupérable — corps UNIQUE des routes de paiement.
 *
 * ⚠️ Les deux routes divergeaient sur la FORME du refus : `mtnPayment.ts` rendait
 * `{ error, code: 'PHONE_INVALID' }`, `campayPayment.ts` un `{ error }` nu. Cosmétique
 * aujourd'hui — mesuré : `POS.tsx` fait un `catch {}` nu et `lib/api.ts` ne lit que
 * `errJson.error`, jamais `code` — mais c'est le genre d'écart qui se paie plus tard,
 * exactement comme les deux `normalizeCameroonPhone` homonymes.
 *
 * ⚠️ LE MESSAGE EST DÉRIVÉ DE LA POLITIQUE, pas écrit à la main. Sinon un « format
 * Cameroun attendu » survivrait à un passage en `international` et dirait au commerçant
 * l'inverse de ce que la route accepte.
 */
export function phoneInvalidBody(policy: MsisdnPolicy) {
  return {
    error: policy === 'cm-only'
      ? 'Numéro de téléphone invalide (format Cameroun attendu)'
      : 'Numéro de téléphone invalide (8 à 15 chiffres attendus)',
    code: 'PHONE_INVALID' as const,
  }
}
