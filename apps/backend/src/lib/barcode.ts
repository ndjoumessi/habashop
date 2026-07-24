// ── Codes-barres (Chantier A) ────────────────────────────────────────────────
// Le code-barres produit est OPTIONNEL (beaucoup de produits vrac n'en ont pas).
// S'il est renseigné, on ACCEPTE trois symbologies GS1 physiquement présentes
// sur les emballages d'une épicerie ouest-africaine :
//   - EAN-13 : le standard (13 chiffres + clé).
//   - EAN-8  : petits conditionnements (sardines, bonbons…) — 8 chiffres + clé.
//     Conservé TEL QUEL, non convertible en EAN-13.
//   - UPC-A  : produits importés d'Amérique du Nord — 12 chiffres + clé.
//     Converti en EAN-13 SANS PERTE par préfixe « 0 » (la clé UPC-A est aussi
//     une clé EAN-13 valide) → un seul format canonique en base.
//
// ⚠️ RÈGLE PARTAGÉE (anti-dérive) : `normalizeBarcode` + `isValidBarcode` sont
// dupliqués à l'identique dans `mobile/src/lib/barcode.ts`. Les deux miroirs
// sont testés contre `docs/shared-fixtures/barcode-cases.json`. Toute évolution
// de la règle doit toucher LES DEUX côtés + la fixture.
//
// ⚠️ JAMAIS de suppression des zéros de tête : un EAN-13 dérivé d'un UPC-A
// commence par « 0 » ; le retirer côté recherche rendrait le produit
// introuvable au scan. Stockage et recherche partagent `normalizeBarcode`.
//
// L'unicité par tenant est vérifiée par REQUÊTE (findFirst) côté handler, PAS
// par contrainte DB @@unique : barcodes vides multiples + soft-delete (deletedAt)
// l'interdisent (cf. audit Chantier A étape 0).

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

/** true si `code` est un EAN-13 syntaxiquement et arithmétiquement valide. */
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
 * true si `code` (déjà CANONIQUE, cf. normalizeBarcode) est un code-barres
 * accepté : EAN-13 ou EAN-8. Un UPC-A a déjà été converti en EAN-13 par
 * normalizeBarcode ⇒ ne pas passer un UPC-A brut ici.
 */
export function isValidBarcode(code: string): boolean {
  return isValidEAN13(code) || isValidEAN8(code)
}

/**
 * Forme CANONIQUE d'un code-barres, RÈGLE UNIQUE stockage + recherche :
 *   - supprime tout espace (les lecteurs en insèrent parfois) ;
 *   - un UPC-A (12 ch.) valide → EAN-13 par préfixe « 0 » (sans perte) ;
 *   - tout le reste est conservé tel quel (EAN-13/EAN-8 déjà canoniques, ou
 *     saisie invalide qu'`isValidBarcode` rejettera ensuite).
 * Renvoie '' pour une entrée vide/non chaîne (⇒ « pas de code-barres »).
 */
export function normalizeBarcode(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const digits = raw.replace(/\s+/g, '')
  if (isValidUPCA(digits)) return '0' + digits
  return digits
}

/**
 * Résolution d'un code SCANNÉ vers un produit : code-barres canonique **OU SKU EXACT**
 * (étiquettes CODE128-sur-SKU). JAMAIS de correspondance par sous-chaîne ni par nom :
 * à la caisse, un faux positif (mauvais produit encaissé) coûte plus cher qu'un échec
 * de scan.
 *
 * ⚠️ Troisième miroir de la règle canonique (web + mobile l'avaient déjà, le backend
 * non) — les `scanCases` de `docs/shared-fixtures/barcode-cases.json` verrouillent
 * l'identité des trois implémentations.
 */
export function matchesScannedCode(
  p: { barcode?: string | null; sku?: string | null },
  raw: string,
): boolean {
  const scanned = normalizeBarcode(raw)
  if (scanned && normalizeBarcode(p.barcode) === scanned) return true
  const sku = (p.sku ?? '').trim().toLowerCase()
  const q = String(raw ?? '').trim().toLowerCase()
  return !!sku && !!q && sku === q
}
