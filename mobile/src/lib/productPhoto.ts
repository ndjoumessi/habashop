/**
 * PHOTO DE PRODUIT — la DÉCISION de redimensionnement, isolée du natif.
 *
 * ⚠️ VALEURS PARTAGÉES AVEC LE WEB, et rien ne les empêcherait de diverger : les
 * deux plateformes redimensionnent CHEZ ELLES (le serveur n'a pas de `sharp`) avec
 * des outils sans aucun code commun — `canvas.toBlob` côté web,
 * `expo-image-manipulator` ici. La fixture `docs/shared-fixtures/product-photo.json`
 * porte les nombres, et un test jumeau de CHAQUE côté échoue si l'un bouge seul.
 *
 * ⚠️ LE PRÉCÉDENT EST LÀ POUR ÊTRE COPIÉ PAR ERREUR : `useSupplierOcr` compresse à
 * **1920 px / qualité 0,7** — c'est juste pour de l'OCR, où seul le texte compte.
 * Reprendre ces chiffres pour une photo de produit la rendrait environ 14× plus
 * lourde sans rien apporter à l'écran, et R2 se facture au Go·MOIS.
 *
 * ⚠️ À NE PAS CONFONDRE avec la PHOTO DE PROFIL mobile, qui est une URI locale
 * gardée dans AsyncStorage, jamais envoyée, en 200×200. Trois notions de « photo »
 * cohabitent dans cette application ; celle-ci est la seule qui parte au serveur.
 */

/** Côté maximal. MARGE assumée : la plus grande vignette fait 56 px ici, 64 px sur le web. */
export const PRODUIT_MAX_PX = 512

/** Qualité JPEG — plus haute que le 0,7 de l'OCR : ici c'est la photo qu'on regarde. */
export const PRODUIT_QUALITE = 0.82

export type ActionRedimension = { resize: { width: number } } | { resize: { height: number } }

/**
 * L'action de redimensionnement à appliquer, ou `null` s'il n'y a rien à faire.
 *
 * ⚠️ FONCTION PURE, séparée du dessin — même raison que `dimensionsCibles` côté
 * web : jest n'a ni décodeur d'image ni moteur natif, donc la manipulation réelle
 * n'est pas exerçable. Ce qui EST exerçable — la décision — l'est ici.
 *
 * ⚠️ ON BORNE LE PLUS GRAND CÔTÉ, pas la largeur. `useSupplierOcr` ne contraint que
 * la largeur : sur une photo PORTRAIT prise au téléphone — le cas le plus courant —
 * la hauteur reste libre, et l'image dépasse le plafond qu'on croyait avoir posé.
 *
 * ⚠️ ON N'AGRANDIT JAMAIS : une photo de 80 px reste à 80 px. Agrandir ajoute des
 * octets sans ajouter d'information, et ces octets se paient tous les mois.
 */
export function actionRedimension(
  largeur?: number,
  hauteur?: number,
  maxPx: number = PRODUIT_MAX_PX,
): ActionRedimension | null {
  // Dimensions inconnues : on ne devine pas. Le picker les fournit presque toujours ;
  // quand il ne le fait pas, mieux vaut envoyer l'original que redimensionner au hasard.
  if (!largeur || !hauteur) return null
  if (Math.max(largeur, hauteur) <= maxPx) return null
  return largeur >= hauteur ? { resize: { width: maxPx } } : { resize: { height: maxPx } }
}
