// ── Codes-barres (Chantier A) — MIROIR de apps/backend/src/lib/barcode.ts ─────
// La règle DOIT rester identique au backend : stockage (backend) et recherche au
// scan (ici) partagent la même canonicalisation, sinon un produit stocké devient
// introuvable. Les deux miroirs sont testés contre la MÊME fixture
// `docs/shared-fixtures/barcode-cases.json` — toute évolution touche les 2 côtés.
//
// Symbologies acceptées : EAN-13 (standard), EAN-8 (petits conditionnements,
// conservé tel quel), UPC-A (importés Amérique du Nord → EAN-13 sans perte par
// préfixe « 0 »). ⚠️ JAMAIS de suppression des zéros de tête : un EAN-13 dérivé
// d'un UPC-A commence par « 0 » ; le retirer côté scan casserait le round-trip.

/** Clé de contrôle EAN-13 pour une base de 12 chiffres. */
export function ean13CheckDigit(base12: string): number {
  const sum = base12
    .split('')
    .reduce((acc, d, i) => acc + parseInt(d, 10) * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10
}

/** Clé de contrôle EAN-8 pour une base de 7 chiffres (poids 3,1,3,1… depuis la gauche). */
export function ean8CheckDigit(base7: string): number {
  const sum = base7
    .split('')
    .reduce((acc, d, i) => acc + parseInt(d, 10) * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10
}

/** Clé de contrôle UPC-A pour une base de 11 chiffres (poids 3,1,3,1… depuis la gauche). */
export function upcaCheckDigit(base11: string): number {
  const sum = base11
    .split('')
    .reduce((acc, d, i) => acc + parseInt(d, 10) * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10
}

/** true si `code` est un EAN-13 valide. */
export function isValidEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false
  return ean13CheckDigit(code.slice(0, 12)) === parseInt(code[12], 10)
}

/** true si `code` est un EAN-8 valide. */
export function isValidEAN8(code: string): boolean {
  if (!/^\d{8}$/.test(code)) return false
  return ean8CheckDigit(code.slice(0, 7)) === parseInt(code[7], 10)
}

/** true si `code` est un UPC-A (12 chiffres) valide. */
export function isValidUPCA(code: string): boolean {
  if (!/^\d{12}$/.test(code)) return false
  return upcaCheckDigit(code.slice(0, 11)) === parseInt(code[11], 10)
}

/**
 * true si `code` (déjà CANONIQUE) est un code-barres accepté : EAN-13 ou EAN-8.
 * Un UPC-A a déjà été converti en EAN-13 par normalizeBarcode.
 */
export function isValidBarcode(code: string): boolean {
  return isValidEAN13(code) || isValidEAN8(code)
}

/**
 * Forme CANONIQUE d'un code-barres, RÈGLE UNIQUE stockage + recherche :
 *   - supprime tout espace / saut de ligne parasite du scanner ;
 *   - un UPC-A (12 ch.) valide → EAN-13 par préfixe « 0 » (sans perte) ;
 *   - tout le reste conservé tel quel.
 * Renvoie '' pour les valeurs vides/nulles : l'appelant DOIT ignorer une
 * normalisation vide pour ne pas matcher un produit au barcode vide.
 */
export const normalizeBarcode = (b: string | null | undefined): string => {
  const digits = String(b ?? '').replace(/\s+/g, '')
  if (isValidUPCA(digits)) return '0' + digits
  return digits
}

/**
 * BRIQUE UNIQUE de la RECHERCHE par code-barres (mirror du web) : vrai si `query`
 * retrouve le produit au code `stored` — sous-chaîne de chiffres (frappe partielle)
 * OU égalité canonique (un UPC-A tapé/scanné retrouve l'EAN-13 stocké). Les deux
 * côtés passent par normalizeBarcode → aucune dérive avec le stockage.
 */
export const barcodeMatches = (stored: string | null | undefined, query: string): boolean => {
  const s = normalizeBarcode(stored)
  if (!s) return false
  const q = String(query ?? '').replace(/\s+/g, '')
  if (!q) return false
  return s.includes(q) || s === normalizeBarcode(query)
}
