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
/**
 * Douchette SANS terminateur : certaines n'envoient PAS Entrée. Elles émettent une rafale
 * puis s'arrêtent. Passé ce délai d'INACTIVITÉ après la dernière touche, l'appelant tranche —
 * c'est le seul signal de fin dont il dispose. Doit rester AU-DESSUS de l'écart inter-caractère
 * d'une douchette (~1-10 ms) pour ne pas tirer au milieu d'une rafale, et court pour rester
 * imperceptible. ⚠️ `elapsed` se mesure de la 1re à la DERNIÈRE touche, jamais jusqu'au
 * déclenchement d'inactivité — sinon le délai diluerait la cadence sous le seuil.
 */
export const WEDGE_IDLE_MS = 60

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
  return looksLikeScannerBurst(v, elapsedMs)
}

/**
 * La VOIE VITESSE seule — sans la voie forme. C'est le seul verdict admissible quand on
 * tranche sur l'INACTIVITÉ (douchette sans terminateur), et la raison est mesurée :
 *
 * ⚠️ **10,0 % des EAN-13 ont un préfixe de 12 caractères qui est un UPC-A VALIDE**
 * (mesuré sur 10 000 codes à somme de contrôle correcte ; la collision tombe exactement à 12,
 * la somme de contrôle ayant une chance sur dix de retomber juste). Un caissier qui RECOPIE
 * un code à la main marque des pauses : s'il s'arrête plus longtemps que le délai d'inactivité
 * après le 12ᵉ chiffre, la voie forme validerait le code PARTIEL. On viderait alors le champ et
 * on ajouterait **un autre produit** au panier — une erreur d'argent, silencieuse, une fois sur
 * dix. Le tir sur inactivité ne peut donc PAS s'autoriser de la forme.
 *
 * La cadence, elle, ne se confond pas : aucune main ne tient 30 ms/caractère. Une rafale qui
 * s'arrête EST une douchette. La recopie manuelle reste servie par **Entrée** (#148), où la
 * saisie est terminée par construction — c'est l'appui qui dit « j'ai fini », pas une horloge.
 */
export function looksLikeScannerBurst(value: string, elapsedMs: number | null): boolean {
  const v = String(value ?? '').trim()
  if (!v) return false
  if (elapsedMs == null) return false
  if (v.length < WEDGE_MIN_LENGTH) return false
  return elapsedMs / v.length <= WEDGE_MAX_MS_PER_CHAR
}
