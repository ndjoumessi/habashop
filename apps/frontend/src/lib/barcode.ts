// ── Codes-barres (Chantier A) — MIROIR de apps/backend/src/lib/barcode.ts ─────
// La règle DOIT rester identique au backend et au mobile : stockage (backend),
// saisie/validation (fiche produit) et recherche au scan (POS) partagent la
// MÊME canonicalisation, sinon un produit stocké devient introuvable. Les trois
// miroirs sont testés contre `docs/shared-fixtures/barcode-cases.json` — toute
// évolution touche les 3 côtés.
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

/** Symbologie JsBarcode d'un code canonique (pour le rendu). null si non reconnu. */
export function barcodeFormat(code: string): 'EAN13' | 'EAN8' | null {
  if (isValidEAN13(code)) return 'EAN13'
  if (isValidEAN8(code)) return 'EAN8'
  return null
}

/**
 * Forme CANONIQUE d'un code-barres, RÈGLE UNIQUE stockage + saisie + recherche :
 *   - supprime tout espace (les lecteurs en insèrent parfois) ;
 *   - un UPC-A (12 ch.) valide → EAN-13 par préfixe « 0 » (sans perte) ;
 *   - tout le reste est conservé tel quel.
 * Renvoie '' pour une entrée vide/non chaîne (⇒ « pas de code-barres »).
 */
export function normalizeBarcode(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const digits = raw.replace(/\s+/g, '')
  if (isValidUPCA(digits)) return '0' + digits
  return digits
}

/**
 * Génère un EAN-13 interne valide (préfixe « 200 » = plage interne, non-GS1).
 * Second recours quand un produit n'a PAS de code-barres fabricant à scanner.
 * `rnd` injectable pour les tests.
 */
export function generateEAN13(rnd: () => number = Math.random): string {
  const base = '200' + Array.from({ length: 9 }, () => Math.floor(rnd() * 10)).join('')
  return base + String(ean13CheckDigit(base))
}

/**
 * Un code-barres est ACCEPTABLE s'il est vide (pas de code = OK) ou canoniquement
 * valide (EAN-13/EAN-8, UPC-A converti). BRIQUE UNIQUE de la garde de saisie —
 * remplace tout `/^\d{13}$/` local (fiche produit, save, lookup auto-remplissage).
 */
export function isAcceptableBarcode(raw: unknown): boolean {
  const c = normalizeBarcode(raw)
  return !c || isValidBarcode(c)
}

/**
 * BRIQUE UNIQUE de la RECHERCHE par code-barres (inventaire, POS, mobile).
 * Vrai si `query` retrouve le produit au code `stored` :
 *   - sous-chaîne de chiffres → frappe manuelle partielle (« 4006 ») ;
 *   - égalité canonique → un UPC-A tapé/scanné (12) retrouve l'EAN-13 stocké (13).
 * Les deux côtés passent par `normalizeBarcode` → aucune dérive avec le stockage.
 */
export function barcodeMatches(stored: string | null | undefined, query: string): boolean {
  const s = normalizeBarcode(stored ?? '')
  if (!s) return false
  const q = String(query ?? '').replace(/\s+/g, '')
  if (!q) return false
  return s.includes(q) || s === normalizeBarcode(query)
}
