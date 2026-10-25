/**
 * Décomposition HT / TVA d'une facture — SOURCE UNIQUE.
 *
 * `Sale.total` est le **TTC** ; HT et TVA s'en DÉRIVENT. La formule vivait dans
 * `buildInvoicePdf` seul ; la page publique (`/f/<jeton>`) montre la même facture au même
 * client, et la recalculer là-bas aurait créé deux chiffres pour une seule grandeur — la
 * famille de défauts la plus coûteuse de ce dépôt (§ LE TOTAL CALCULÉ SUR CE QUI EST
 * AFFICHÉ). Le PDF et la page lisent donc la même fonction, et la page ne calcule RIEN :
 * elle affiche ce que la route lui envoie.
 *
 * ⚠️ Aucun arrondi ici. Les montants sont en **base XOF** et l'arrondi appartient au
 * formatage, qui dépend de la devise d'affichage (0 décimale en XOF/XAF, 2 ailleurs) —
 * arrondir en amont ferait que HT + TVA ≠ TTC à l'écran.
 */
export interface InvoiceTotals {
  /** TTC — ce que le client a payé. */
  totalTTC: number
  /** Hors taxes. Égal au TTC quand la boutique n'applique aucune TVA. */
  subtotalHT: number
  /** Montant de TVA. **0** quand le taux est nul — jamais une part inventée. */
  vatAmount: number
}

export function invoiceTotals(totalTTC: number, vatRate: number): InvoiceTotals {
  const ttc = Number(totalTTC) || 0
  const vat = Number(vatRate) || 0
  // ⚠️ Un taux négatif ou ≥ 100 % rendrait un HT absurde (négatif, ou supérieur au TTC) :
  // on le traite comme « pas de TVA » plutôt que d'imprimer un chiffre impossible.
  const applicable = vat > 0 && vat < 100
  const subtotalHT = applicable ? ttc / (1 + vat / 100) : ttc
  return { totalTTC: ttc, subtotalHT, vatAmount: ttc - subtotalHT }
}
