import { isValidBarcode, normalizeBarcode } from '@/lib/barcode'

/**
 * Douchette USB/Bluetooth = clavier (« keyboard wedge ») : elle TAPE le code puis
 * envoie Entrée. C'est le chemin de scan PRIMAIRE en boutique — plus courant que la
 * caméra. Jusqu'ici il ne passait pas par la résolution de scan : la saisie filtrait
 * simplement la grille, et sur cache périmé le caissier voyait une grille VIDE, sans
 * un mot d'explication. Même incident que le scan caméra, autre porte d'entrée.
 *
 * Il faut donc distinguer, à l'appui sur Entrée, une saisie DOUCHETTE d'une frappe
 * humaine — sans casser la recherche par nom.
 *
 * ⚠️ Aucune regex de code-barres locale ici : la forme est jugée par la brique
 * canonique `lib/barcode.ts` — un méta-test interdit toute garde « 13 chiffres »
 * réécrite hors de ce lib (il scanne le TEXTE des sources, commentaires compris :
 * écrire le motif ne serait-ce qu'en commentaire le fait rougir, comme ici).
 */

/** Au-delà, c'est une main humaine. Une douchette émet à ~1-10 ms par caractère. */
export const WEDGE_MAX_MS_PER_CHAR = 30
/** En deçà, trop court pour trancher sur la seule vitesse (« ok », « 12 »…). */
export const WEDGE_MIN_LENGTH = 4

/** Ce que l'appelant mesure : instant de la 1re touche, et longueur au moment d'Entrée. */
export type ScanTiming = { firstKeyAt: number | null; at: number }

/** Durée de frappe, ou `null` si non mesurable (collé, autocomplété…). */
export function typingElapsed(timing: ScanTiming): number | null {
  if (timing.firstKeyAt == null) return null
  return Math.max(0, timing.at - timing.firstKeyAt)
}

/**
 * La saisie doit-elle être traitée comme un SCAN plutôt que comme une recherche ?
 *
 * Deux voies, volontairement indépendantes :
 *  1. **la forme** — un code-barres canoniquement valide est un code, même tapé
 *     lentement à la main (sinon un caissier recopiant un code verrait, lui aussi,
 *     une grille vide muette) ;
 *  2. **la vitesse** — une frappe à cadence machine est une douchette, quel que soit
 *     le contenu : c'est ce qui rattrape les étiquettes CODE128-sur-SKU, qui ne sont
 *     pas des codes-barres numériques.
 *
 * Tout le reste — « lait », « riz 5kg » — reste une recherche et filtre la grille.
 */
export function looksLikeScannedInput(value: string, elapsedMs: number | null): boolean {
  const v = String(value ?? '').trim()
  if (!v) return false
  // 1. Forme canonique (jamais une regex locale — cf. lib/barcode.ts).
  if (isValidBarcode(normalizeBarcode(v))) return true
  // 2. Cadence machine.
  if (elapsedMs == null) return false
  if (v.length < WEDGE_MIN_LENGTH) return false
  return elapsedMs / v.length <= WEDGE_MAX_MS_PER_CHAR
}
