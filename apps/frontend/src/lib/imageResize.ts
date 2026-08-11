/**
 * REDIMENSIONNEMENT D'AVATAR AVANT ENCODAGE.
 *
 * ─── POURQUOI ────────────────────────────────────────────────────────────────
 * La photo d'employé partait en base64 dans une colonne `Text`, à la taille du
 * fichier choisi (garde à 2 Mo). MESURÉ le 2026-08-09 sur `GET /api/employees` :
 *
 *   5 employés, sans photo    →        2 146 octets
 *   5 employés × 2 Mo base64  →   13 983 156 octets  (14,0 Mo)
 *   50 employés × 2 Mo base64 →  139 812 246 octets  (139,8 Mo)
 *
 * …rendus à CHAQUE ouverture de la page RH, sans pagination. Or un avatar
 * s'affiche entre 40 et 100 px : les 2 Mo sont un GARDE, pas un besoin. À 256 px
 * la même photo pèse ~20 Ko, et 50 employés tiennent dans 1 Mo.
 *
 * ⚠️ CE MODULE NE RÈGLE PAS LE STOCKAGE, il règle la TAILLE. Le jour où le
 * catalogue portera des photos de produits, le bon foyer est un stockage objet
 * (R2 : egress gratuit, compatible S3, et `suppliers.ts` fait déjà du multipart).
 * Ce module reste utile alors — on redimensionne avant d'envoyer, où qu'on envoie.
 *
 * ⚠️ LA VALEUR DE RETOUR EST UNE CHAÎNE, délibérément. Aujourd'hui une data URI,
 * demain une URL `https://`. Les deux vont dans un `<img src>` sans rien changer
 * en aval : la migration ne touchera que ce module et le point d'appel.
 */

/** Côté maximal d'un avatar stocké. 256 px couvre un affichage rétina à 128 px. */
export const AVATAR_MAX_PX = 256

/** Qualité JPEG. 0,82 est le point où l'artefact cesse d'être visible sur un visage. */
export const AVATAR_QUALITE = 0.82

/**
 * Dimensions cibles en préservant le rapport d'aspect.
 *
 * ⚠️ FONCTION PURE, séparée du dessin : jsdom n'a ni `<canvas>` ni décodeur
 * d'image, donc le redimensionnement réel n'est pas exerçable en test unitaire.
 * Ce qui EST exerçable — le calcul — l'est ici. Écrire un test qui « vérifie » le
 * dessin sous jsdom rendrait un vert qui ne prouve rien.
 *
 * ⚠️ On n'AGRANDIT jamais : une photo de 80 px reste à 80 px. Agrandir ajoute des
 * octets sans ajouter d'information.
 */
export function dimensionsCibles(
  largeur: number,
  hauteur: number,
  maxPx: number = AVATAR_MAX_PX,
): { largeur: number; hauteur: number } {
  if (!Number.isFinite(largeur) || !Number.isFinite(hauteur) || largeur <= 0 || hauteur <= 0) {
    return { largeur: 0, hauteur: 0 }
  }
  const plusGrand = Math.max(largeur, hauteur)
  if (plusGrand <= maxPx) return { largeur: Math.round(largeur), hauteur: Math.round(hauteur) }
  const facteur = maxPx / plusGrand
  // ⚠️ `max(1, …)` : une image de 4000×3 donnerait une hauteur de 0 et un canvas invalide.
  return {
    largeur: Math.max(1, Math.round(largeur * facteur)),
    hauteur: Math.max(1, Math.round(hauteur * facteur)),
  }
}

/**
 * Lit un fichier image et rend une data URI JPEG bornée à `maxPx`.
 *
 * ⚠️ Rejette si l'image est illisible plutôt que de rendre une chaîne vide : un
 * repli silencieux effacerait la photo existante au premier fichier corrompu.
 */
export function resizeToDataUrl(
  fichier: Blob,
  maxPx: number = AVATAR_MAX_PX,
): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const { largeur, hauteur } = dimensionsCibles(img.naturalWidth, img.naturalHeight, maxPx)
      if (!largeur || !hauteur) { rejeter(new Error('Image sans dimensions')); return }
      const canvas = document.createElement('canvas')
      canvas.width = largeur
      canvas.height = hauteur
      const ctx = canvas.getContext('2d')
      if (!ctx) { rejeter(new Error('Canvas indisponible')); return }
      // Fond blanc : un PNG transparent deviendrait NOIR en JPEG.
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, largeur, hauteur)
      ctx.drawImage(img, 0, 0, largeur, hauteur)
      resoudre(canvas.toDataURL('image/jpeg', AVATAR_QUALITE))
    }
    img.onerror = () => { URL.revokeObjectURL(url); rejeter(new Error('Image illisible')) }
    img.src = url
  })
}
