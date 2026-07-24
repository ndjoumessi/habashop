// ── Réconciliation du total encaissé vs total FACTURÉ par le serveur ─────────────
//
// Le serveur est autoritaire sur le prix (cf. CLAUDE.md § Intégrité prix) : si le tarif a
// changé pendant que le terminal était sur un catalogue en cache, il re-tarife et facture
// SON prix. Jusqu'ici le front jetait la réponse de `POST /api/sales` → le caissier encaissait
// 1 000, la vente était enregistrée à 1 200, et personne ne l'apprenait. La caisse se
// retrouvait courte à la clôture, sans cause explicable.
//
// Ce module ne décide rien : il compare deux nombres et nomme l'écart.

export type SaleGap = {
  /** Écart SIGNÉ, en XOF : > 0 = le serveur a facturé PLUS que ce qui a été encaissé. */
  gap: number
  /** Sens de l'action pour le caissier, face au client encore présent. */
  action: 'claim' | 'refund'
}

// Tolérance : 1 unité, comme la règle du paiement mixte (|somme − total| ≤ 1). Absorbe les
// arrondis d'un côté et de l'autre (TVA HT ajoutée, remise fidélité) sans masquer un écart réel :
// un changement de tarif se compte en dizaines ou centaines, jamais en unité.
export const RECONCILE_TOLERANCE = 1

/**
 * Renvoie l'écart à signaler, ou `null` si les deux totaux concordent.
 *
 * ⚠️ Un total serveur non exploitable (absent, NaN) renvoie `null` : on ne fabrique JAMAIS
 * une alerte d'argent à partir d'une donnée qu'on n'a pas. L'absence de preuve d'écart n'est
 * pas une preuve d'écart — même principe que la qualification `staleCatalogAt` côté serveur.
 */
// ⚠️ `Number(null)` et `Number('')` valent **0**, pas NaN. Sans ce filtre explicite, un total
// serveur ABSENT devenait un total de 0 : alerte « rendre 1 000 F au client » sur une vente
// saine, et ticket imprimé à 0. L'absence de donnée doit rester une absence.
function readTotal(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function reconcileSaleTotal(
  serverTotal: unknown,
  clientNet: number,
  tolerance: number = RECONCILE_TOLERANCE,
): SaleGap | null {
  const billed = readTotal(serverTotal)
  if (billed === null || !Number.isFinite(clientNet)) return null
  const gap = Math.round(billed - clientNet)
  if (Math.abs(gap) <= tolerance) return null
  return { gap, action: gap > 0 ? 'claim' : 'refund' }
}

/**
 * Total à faire figurer sur les documents remis au CLIENT (ticket imprimé, reçu WhatsApp).
 * Le serveur fait foi dès qu'il a répondu — sinon la facture PDF (générée côté serveur)
 * contredirait le ticket papier remis en main propre.
 */
export function authoritativeTotal(serverTotal: unknown, clientNet: number): number {
  return readTotal(serverTotal) ?? clientNet
}
