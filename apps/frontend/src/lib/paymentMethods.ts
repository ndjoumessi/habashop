/**
 * MOYENS DE PAIEMENT D'ABONNEMENT — source unique, côté FRONTEND.
 *
 * ⚠️ JUMEAU À L'IDENTIQUE de `apps/backend/src/lib/paymentMethods.ts`, exercé contre
 * `docs/shared-fixtures/payment-methods.json` (lu à l'EXÉCUTION, jamais importé : le
 * contexte de build Docker du backend est `apps/backend` seul, un import hors de cette
 * frontière casse le déploiement en TS2307 sans que `tsc` local ne le voie).
 *
 * ─── CE QU'IL REMPLACE ───────────────────────────────────────────────────────
 * TROIS implémentations, mesurées le 2026-08-06 :
 *   `UpgradePlan.tsx:22`     catalogue de 4 (pas de `card`), Wave en #00B3FF
 *   `email.ts:297`           Record de 5, pictogramme COLLÉ dans le libellé
 *   `AdminDashboard.tsx:566` ternaire binaire → au-delà de 2 marques, le champ BRUT
 *                            (« virement », « mtn_money ») était affiché à l'opérateur
 *
 * ⚠️ `offeredInTunnel` distingue ce qu'on PROPOSE de ce qu'on sait NOMMER — même
 * distinction que `purchasable` / `billable` du catalogue de plans. `card` n'est pas
 * proposé à l'abonnement (aucun processeur branché) mais reste enregistrable par un
 * admin comme méthode d'un paiement reçu : il lui faut donc un libellé.
 *
 * ⚠️ Les marques ne se traduisent pas ; seuls `virement` et `card` ont quatre formes.
 */

export type PaymentMethodId = 'wave' | 'orange_money' | 'mtn_money' | 'virement' | 'card'
export type MethodLang = 'fr' | 'en' | 'es' | 'it'

export interface PaymentMethod {
  id: PaymentMethodId
  /** Pictogramme. JAMAIS collé au libellé : c'est l'appelant qui compose. */
  emoji: string
  /** Marque, non traduite. Exclusif avec `label`. */
  brand: string | null
  /** Libellé traduit. Exclusif avec `brand`. */
  label: Readonly<Record<MethodLang, string>> | null
  colorHex: string
  /** Jeton CSS équivalent — le front le préfère, le backend n'en a pas l'usage. */
  cssVar: string
  /** Proposé dans le tunnel d'abonnement. `false` = nommable, pas vendable. */
  offeredInTunnel: boolean
}

export const PAYMENT_METHODS: readonly PaymentMethod[] = [
  { id: 'wave',         emoji: '🌊', brand: 'Wave',         label: null, colorHex: '#1B9AF5', cssVar: '--brand-wave', offeredInTunnel: true },
  { id: 'orange_money', emoji: '🟠', brand: 'Orange Money', label: null, colorHex: '#FF6600', cssVar: '--brand-om',   offeredInTunnel: true },
  { id: 'mtn_money',    emoji: '💛', brand: 'MTN Money',    label: null, colorHex: '#FFCC00', cssVar: '--brand-mtn',  offeredInTunnel: true },
  { id: 'virement',     emoji: '🏦', brand: null, colorHex: '#6C47FF', cssVar: '--p',    offeredInTunnel: true,
    label: { fr: 'Virement bancaire', en: 'Bank transfer', es: 'Transferencia bancaria', it: 'Bonifico bancario' } },
  { id: 'card',         emoji: '💳', brand: null, colorHex: '#00D084', cssVar: '--acc2', offeredInTunnel: false,
    label: { fr: 'Carte bancaire', en: 'Bank card', es: 'Tarjeta bancaria', it: 'Carta di credito' } },
]

export function getPaymentMethod(id: unknown): PaymentMethod | null {
  return PAYMENT_METHODS.find(m => m.id === id) ?? null
}

/** Moyens réellement proposés dans le tunnel d'abonnement. */
export function tunnelPaymentMethods(): PaymentMethod[] {
  return PAYMENT_METHODS.filter(m => m.offeredInTunnel)
}

/**
 * Libellé d'un moyen de paiement.
 *
 * ⚠️ Un identifiant INCONNU est rendu tel quel, jamais assimilé à un moyen connu — mais
 * il ne doit plus apparaître nu : c'est ce que faisait le ternaire d'`AdminDashboard`
 * pour TROIS des cinq valeurs légitimes.
 */
export function paymentMethodLabel(id: unknown, lang: MethodLang = 'fr'): string {
  const m = getPaymentMethod(id)
  if (!m) return typeof id === 'string' && id ? id : '—'
  return m.brand ?? m.label![lang] ?? m.label!.fr
}

/** Couleur d'accent — jeton CSS côté web, hex partout ailleurs. */
export function paymentMethodColor(id: unknown, prefer: 'css' | 'hex' = 'css'): string {
  const m = getPaymentMethod(id)
  if (!m) return prefer === 'css' ? 'var(--text3)' : '#8888A8'
  return prefer === 'css' ? `var(${m.cssVar})` : m.colorHex
}
