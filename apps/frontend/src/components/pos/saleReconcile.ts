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

// ── Dérive PRÉ-vente : un tarif a-t-il bougé pendant que le panier se montait ? ──────────
// Le panier fige le prix de chaque ligne à l'AJOUT ; rafraîchir le catalogue ne corrige pas
// seul ces prix figés. Pour prévenir le caissier AVANT qu'il encaisse (et pas seulement via
// la réconciliation post-vente ci-dessus), on compare le prix capturé de chaque ligne au prix
// FRAIS recalculé depuis le catalogue rafraîchi. ⚠️ Best-effort, jamais bloquant : si le
// rafraîchissement n'a pas encore répondu, la liste est vide et reconcileSaleTotal prend le
// relais après la vente.
export type CartLineForDrift = { id: string | number; name: string; price: number; qty: number }
export type PriceDrift = { id: string | number; name: string; oldPrice: number; newPrice: number; tierLabel: string | null }

// `freshPrice(id, qty)` = prix frais + tierLabel pour ce produit à cette quantité, ou `null`
// si le produit a disparu du catalogue (rien à comparer → on n'invente pas de dérive).
// Comparaison à l'entier (le POS n'émet pas de sous-unité).
export function detectCartPriceDrift(
  cart: CartLineForDrift[],
  freshPrice: (id: string | number, qty: number) => { price: number; tierLabel?: string } | null,
): PriceDrift[] {
  const out: PriceDrift[] = []
  for (const line of cart) {
    const fresh = freshPrice(line.id, line.qty)
    if (!fresh) continue
    if (Math.round(fresh.price) !== Math.round(line.price)) {
      out.push({ id: line.id, name: line.name, oldPrice: line.price, newPrice: fresh.price, tierLabel: fresh.tierLabel ?? null })
    }
  }
  return out
}

// ── Lignes envoyées au serveur ──────────────────────────────────────────────────────────
export type SaleItemPayload = {
  productId: string; qty: number; price: number
  tierLabel: string | null
  clientType: 'retail' | 'semi' | 'wholesale'
}

/**
 * Construit les lignes de `POST /api/sales` depuis le panier.
 *
 * ⚠️ Cette fonction ne reçoit PAS le tarif couramment sélectionné, et c'est délibéré :
 * chaque ligne déclare le tarif dont SON prix est issu. Le sélecteur peut avoir changé
 * depuis (la dérive ne s'applique que sur action explicite du caissier) — déclarer le
 * tarif courant ferait re-tarifer par le serveur des lignes légitimes, à la baisse.
 * En ne fournissant pas l'information, l'erreur devient impossible à écrire ici.
 *
 * Le repli `'retail'` reflète le POS : le sélecteur démarre sur Détail.
 */
export function toSaleItemPayload(
  cart: { id: string | number; qty: number; price: number; tierLabel?: string; clientType?: 'retail' | 'semi' | 'wholesale' }[],
): SaleItemPayload[] {
  return cart.map(i => ({
    // Catalogue de démonstration : ids numériques → identifiants serveur correspondants.
    productId: /^\d+$/.test(String(i.id)) ? `demo-PRD-${String(i.id).padStart(3, '0')}` : String(i.id),
    qty: i.qty,
    price: i.price,
    tierLabel: i.tierLabel ?? null,
    clientType: i.clientType ?? 'retail',
  }))
}

/**
 * Total à faire figurer sur les documents remis au CLIENT (ticket imprimé, reçu WhatsApp).
 * Le serveur fait foi dès qu'il a répondu — sinon la facture PDF (générée côté serveur)
 * contredirait le ticket papier remis en main propre.
 */
export function authoritativeTotal(serverTotal: unknown, clientNet: number): number {
  return readTotal(serverTotal) ?? clientNet
}
