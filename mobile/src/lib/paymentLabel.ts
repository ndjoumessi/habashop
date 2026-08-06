/**
 * LIBELLÉ DE MODE DE PAIEMENT — source unique des deux reçus mobiles.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * `printReceipt.ts` et `whatsappTicket.ts` portaient la MÊME chaîne à trois branches :
 *
 *   paymentMode === 'cash'   ? t('cash', lang) :
 *   paymentMode === 'wave'   ? 'Wave' :
 *   paymentMode === 'orange' ? 'Orange Money' :
 *   t('card', lang)                              // ← tout le reste devient « Carte »
 *
 * Or le serveur écrit CINQ modes (`cash | wave | orange | mtn | card`), plus `mixed`.
 * Une vente MTN MoMo s'imprimait donc **« Carte »** — sur le document remis à l'acheteur.
 *
 * ⚠️ CHEMIN MESURÉ. `posStore.PaymentMode` du mobile ne contient PAS `mtn` : la caisse
 * mobile ne propose pas MTN, et le défaut semblait donc inatteignable. Il ne l'est pas —
 * `app/(app)/sales/index.tsx:116` réimprime un reçu depuis `sale.paymentMode`, une vente
 * **relue du serveur**. Une vente encaissée en MTN MoMo depuis la caisse WEB, réimprimée
 * ou renvoyée en WhatsApp depuis le mobile, sortait étiquetée « Carte ». `lib/refund.ts`
 * connaissait déjà `mtn` ; les reçus non.
 *
 * ⚠️ `paymentMode` est typé `string` dans `TicketOptions` (il vient de l'API) : le
 * compilateur n'aidait pas, et n'aidera pas davantage. C'est le Record qui porte
 * l'exhaustivité, et le repli qui porte l'honnêteté — une valeur inconnue est rendue
 * TELLE QUELLE, jamais assimilée à un mode connu.
 *
 * ⚠️ Les marques ne se traduisent pas (Wave, Orange Money, MTN MoMo) — cf. § i18n du
 * guide racine. Seuls `cash`, `card` et `mixed` ont quatre formes.
 */

/** Modes écrits par le serveur (`Sale.paymentMode`), plus le mixte du panier. */
export const PAYMENT_MODES = ['cash', 'wave', 'orange', 'mtn', 'card', 'mixed'] as const
export type PaymentModeKey = typeof PAYMENT_MODES[number]

type Quad = Readonly<Record<string, string>>

const TRANSLATED: Record<'cash' | 'card' | 'mixed', Quad> = {
  cash:  { fr: 'Espèces', en: 'Cash',  es: 'Efectivo', it: 'Contanti' },
  card:  { fr: 'Carte',   en: 'Card',  es: 'Tarjeta',  it: 'Carta' },
  mixed: { fr: 'Mixte',   en: 'Split', es: 'Mixto',    it: 'Misto' },
}

interface ModeView {
  /** Pictogramme du reçu WhatsApp. Vide = aucun (le reçu imprimé n'en met jamais). */
  emoji: string
  /** Marque, non traduite. Exclusif avec `translated`. */
  brand?: string
  /** Clé de libellé traduit. Exclusif avec `brand`. */
  translated?: keyof typeof TRANSLATED
}

/**
 * ⚠️ Record EXHAUSTIF : `Record<PaymentModeKey, …>` fait échouer `tsc` si un mode est
 * ajouté à `PAYMENT_MODES` sans être décrit ici. C'est ce que le ternaire ne pouvait pas
 * faire — il avalait silencieusement toute valeur nouvelle dans sa dernière branche.
 */
const VIEWS: Record<PaymentModeKey, ModeView> = {
  cash:   { emoji: '',    translated: 'cash' },
  wave:   { emoji: '🌊',  brand: 'Wave' },
  orange: { emoji: '🟠',  brand: 'Orange Money' },
  mtn:    { emoji: '📱',  brand: 'MTN MoMo' },
  card:   { emoji: '💳',  translated: 'card' },
  mixed:  { emoji: '',    translated: 'mixed' },
}

export function isPaymentMode(v: unknown): v is PaymentModeKey {
  return typeof v === 'string' && (PAYMENT_MODES as readonly string[]).includes(v)
}

/**
 * Libellé du mode, sans pictogramme — le reçu IMPRIMÉ (thermique / PDF).
 *
 * Un mode inconnu est rendu tel quel, première lettre en capitale : sur un document remis
 * au client, un « Paypal » visible vaut mieux qu'un « Carte » faux.
 */
export function paymentModeLabel(mode: string, lang: string): string {
  if (!isPaymentMode(mode)) return mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : '—'
  const v = VIEWS[mode]
  if (v.brand) return v.brand
  const q = TRANSLATED[v.translated!]
  return q[lang] ?? q.fr
}

/** Libellé préfixé du pictogramme — le reçu WhatsApp. */
export function paymentModeLabelWithEmoji(mode: string, lang: string): string {
  const label = paymentModeLabel(mode, lang)
  const emoji = isPaymentMode(mode) ? VIEWS[mode].emoji : ''
  return emoji ? `${emoji} ${label}` : label
}
