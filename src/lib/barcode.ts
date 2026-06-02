/**
 * Normalise un code-barres pour comparer ce que renvoie le scanner
 * (expo-camera) à ce qui est stocké en base.
 *
 * Cas couverts :
 *  - espaces / sauts de ligne parasites → supprimés
 *  - zéros de tête (UPC-A 12 chiffres ↔ EAN-13 13 chiffres, le scanner et la
 *    base peuvent diverger d'un « 0 » initial) → supprimés des deux côtés
 *
 * Renvoie '' pour les valeurs vides/nulles : l'appelant doit ignorer une
 * normalisation vide pour ne pas matcher un produit au barcode vide.
 */
export const normalizeBarcode = (b: string | null | undefined): string =>
  String(b ?? '')
    .replace(/\s+/g, '')
    .replace(/^0+/, '')
    .trim()
