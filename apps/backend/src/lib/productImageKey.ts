import { createHash } from 'node:crypto'

/**
 * LES DÉCISIONS DE SÛRETÉ DU STOCKAGE D'IMAGES — module PUR, sans réseau ni SDK.
 *
 * Il est séparé de `lib/spend/r2Client.ts` exprès : ce qui décide « ces octets
 * sont-ils une image ? » et « cette URL nous appartient-elle ? » doit être
 * exerçable sans jamais toucher R2. Le client, lui, est confiné par l'allowlist
 * des SDK facturés et ne peut pas être importé librement.
 *
 * ─── CE QUI SE DÉCIDE ICI ────────────────────────────────────────────────────
 * 1. Le TYPE se lit dans les OCTETS, jamais dans le `Content-Type` déclaré.
 * 2. La CLÉ est cloisonnée par tenant et porte l'empreinte du contenu.
 * 3. Une URL qui n'est pas manifestement la NÔTRE ne rend AUCUNE clé.
 */

// ── 1. Le type réel, lu dans les octets ──────────────────────────────────────

/**
 * ⚠️ LE `mimetype` DÉCLARÉ PAR LE CLIENT NE VAUT RIEN — il est choisi par
 * l'envoyeur. `suppliers.ts` s'en contente pour l'OCR (le pire cas y est une
 * facture Anthropic gâchée) ; ici l'objet est SERVI PUBLIQUEMENT depuis un
 * domaine à nous, ce qui en fait un tout autre problème : un fichier HTML ou SVG
 * accepté et rendu sous notre domaine exécute du script chez le visiteur du
 * catalogue.
 *
 * ⚠️ SVG DÉLIBÉRÉMENT ABSENT, et ce n'est pas un oubli de format. Un SVG est du
 * TEXTE — il n'a aucune signature d'octets à vérifier, il peut porter
 * `<script>`, et servi depuis notre domaine il s'exécute dans notre origine.
 * Aucune photo de produit prise au téléphone n'est un SVG.
 *
 * ⚠️ GIF absent aussi : rien n'en a besoin, et chaque format accepté est une
 * surface de décodage de plus chez le client.
 */
export type ImageType = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: 'jpg' | 'png' | 'webp' }

export function sniffImageType(buf: Buffer | Uint8Array): ImageType | null {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
  // JPEG : FF D8 FF
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' }
  }
  // PNG : 89 50 4E 47 0D 0A 1A 0A — les huit octets, pas les quatre premiers.
  if (
    b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' }
  }
  // WebP : « RIFF » .... « WEBP ». ⚠️ Les DEUX marqueurs — « RIFF » seul désigne
  // aussi un WAV ou un AVI, qui ne sont pas des images.
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' }
  }
  return null
}

// ── 2. La clé ────────────────────────────────────────────────────────────────

/**
 * ⚠️ LA CLÉ PORTE L'EMPREINTE DU CONTENU, et cela règle deux problèmes d'un coup :
 *
 *  · CACHE — `Product.image` est mise en cache par le service worker web ET
 *    persistée dans AsyncStorage côté mobile. Une URL FIXE par produit servirait
 *    l'ANCIENNE photo après un remplacement, potentiellement pendant des jours,
 *    sans aucun moyen de l'invalider. Un contenu différent ⇒ une URL différente.
 *  · IDEMPOTENCE — renvoyer deux fois les mêmes octets écrit le même objet.
 *
 * ⚠️ CLOISONNÉ PAR TENANT, en préfixe. Ce n'est pas décoratif : c'est ce qui rend
 * vérifiable, à la suppression, qu'une boutique ne touche que ses propres objets
 * (cf. `keyBelongsToTenant`).
 */
export function productImageKey(tenantId: string, productId: string, buf: Buffer, ext: ImageType['ext']): string {
  const empreinte = createHash('sha256').update(buf).digest('hex').slice(0, 32)
  return `tenants/${tenantId}/products/${productId}/${empreinte}.${ext}`
}

/**
 * La FORME que nos clés ont, et la seule qu'on accepte de supprimer.
 * ⚠️ Les identifiants sont des cuid (alphanumériques) : aucun `/`, aucun `.`,
 * donc aucune remontée de chemin possible par un identifiant.
 */
const FORME_CLE = /^tenants\/[A-Za-z0-9_-]+\/products\/[A-Za-z0-9_-]+\/[a-f0-9]{32}\.(?:jpg|png|webp)$/

export function keyBelongsToTenant(key: string, tenantId: string): boolean {
  if (!FORME_CLE.test(key)) return false
  return key.startsWith(`tenants/${tenantId}/products/`)
}

// ── 3. L'URL publique, et le chemin retour ───────────────────────────────────

/** Retire la barre finale — `https://img.x/` et `https://img.x` doivent coïncider. */
function normaliserBase(base: string): string {
  return base.trim().replace(/\/+$/, '')
}

export function publicUrlFor(key: string, base: string): string {
  return `${normaliserBase(base)}/${key}`
}

/**
 * ⚠️ LE CHEMIN RETOUR EST LE POINT DANGEREUX DE CE FICHIER.
 *
 * Pour remplacer ou retirer une photo, il faut retrouver la CLÉ depuis l'URL
 * stockée en base. Or `Product.image` est une colonne `String?` : une valeur
 * arbitraire peut s'y trouver — écrite avant que ce module existe, importée, ou
 * posée par un appelant qu'on n'a pas prévu. Rendre naïvement « ce qui suit le
 * domaine » ferait supprimer un objet qu'on n'a pas écrit.
 *
 * Deux conditions CUMULATIVES, et le doute rend `null` :
 *   (a) l'URL est sous NOTRE base (origine ET chemin de base) ;
 *   (b) le reste a exactement la FORME de nos clés.
 *
 * `null` n'est pas un échec : c'est « cette URL n'est pas à nous, ne touche à
 * rien ». L'appelant efface alors la colonne sans rien supprimer côté R2.
 */
export function keyFromPublicUrl(url: string | null | undefined, base: string): string | null {
  if (!url || !base) return null
  let u: URL
  let b: URL
  try {
    u = new URL(url)
    b = new URL(normaliserBase(base))
  } catch {
    return null
  }
  if (u.origin !== b.origin) return null

  const prefixe = b.pathname.replace(/\/+$/, '')
  if (!u.pathname.startsWith(`${prefixe}/`)) return null

  const cle = decodeURIComponent(u.pathname.slice(prefixe.length + 1))
  return FORME_CLE.test(cle) ? cle : null
}
