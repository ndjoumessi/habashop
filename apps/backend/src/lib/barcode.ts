// ── Codes-barres EAN-13 (Chantier A) ─────────────────────────────────────────
// Le code-barres produit est OPTIONNEL (beaucoup de produits vrac n'en ont pas).
// Mais s'il est renseigné, il doit être un EAN-13 valide : 13 chiffres + clé de
// contrôle GS1 correcte. Ça rattrape les mis-scan / typos et garantit que ce
// qu'on peuple (« scanner d'abord ») est bien scannable et imprimable.
//
// ⚠️ Miroir de `generateEAN13` (frontend StockModals.tsx) — même algorithme de
// clé (poids 1,3,1,3… sur les 12 premiers chiffres). Ne pas diverger.
//
// L'unicité par tenant est vérifiée par REQUÊTE (findFirst) côté handler, PAS
// par contrainte DB @@unique : les barcodes vides multiples et le soft-delete
// (deletedAt) l'interdisent (cf. audit Chantier A étape 0).

/** Clé de contrôle EAN-13 pour une base de 12 chiffres. */
export function ean13CheckDigit(base12: string): number {
  const sum = base12
    .split('')
    .reduce((acc, d, i) => acc + parseInt(d, 10) * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10
}

/** true si `code` est un EAN-13 syntaxiquement et arithmétiquement valide. */
export function isValidEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false
  return ean13CheckDigit(code.slice(0, 12)) === parseInt(code[12], 10)
}

/**
 * Normalise une saisie brute de code-barres : supprime tout espace (les lecteurs
 * physiques en insèrent parfois) et trim. Renvoie '' pour une entrée vide/non
 * chaîne (⇒ « pas de code-barres », valide).
 */
export function normalizeBarcode(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/\s+/g, '')
}
