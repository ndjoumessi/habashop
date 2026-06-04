/**
 * Normalise un nom de categorie pour servir de CLE de regroupement :
 * retire emoji/pictogrammes + selecteurs de variation/ZWJ, collapse les
 * espaces, trim + lowercase. Un prefixe emoji devant Epicerie / Epicerie /
 * epicerie donne la meme cle. Sert UNIQUEMENT de cle (fusion donut CA,
 * dedup filtre Stock) ; le libelle affiche garde la valeur d'origine.
 */
export const normCat = (s: string) => s
  .replace(/\p{Extended_Pictographic}/gu, '')  // emoji / pictogrammes
  .replace(/[\uFE0F\u200D]/g, '')      // selecteur de variation / ZWJ
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()
