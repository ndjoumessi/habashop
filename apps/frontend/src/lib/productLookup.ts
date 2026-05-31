// Lookup produit via Open Food Facts (frontend, CORS-friendly, sans clé API).
// Fonction PURE et testable : ne touche ni au store ni au DOM ; ne lève jamais.
// Pré-remplit un formulaire ; l'utilisateur confirme toujours (aucune sauvegarde auto).

export interface ProductFields {
  name: string      // nom du produit (product_name_fr || product_name)
  brand: string     // marque (brands, 1re valeur)
  category: string  // catégorie nettoyée (categories_tags[0] sans préfixe "en:"/"fr:")
  image: string     // URL image (image_front_url)
  unit: string      // conditionnement (quantity, ex. "400 g")
}

// `reason` distingue "absent de la base" d'une "erreur réseau" pour l'UI ; dans les
// deux cas found=false (la fonction ne lève jamais — cf. contrat demandé). Les `?: never`
// rendent `data`/`reason` accessibles sur le type union sans narrowing au call site.
export type ProductLookupResult =
  | { found: true; data: Partial<ProductFields>; reason?: never }
  | { found: false; reason: 'not_found' | 'network'; data?: never }

const OFF_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product'

// "en:breakfast-cereals" → "breakfast cereals" ; "fr:produits-laitiers" → "produits laitiers".
export function cleanCategoryTag(tag: string): string {
  return tag.replace(/^[a-z]{2}:/i, '').replace(/-/g, ' ').trim()
}

export async function lookupProductByEan(ean: string): Promise<ProductLookupResult> {
  const code = (ean ?? '').trim()
  if (!code) return { found: false, reason: 'not_found' }
  try {
    const res = await fetch(`${OFF_ENDPOINT}/${encodeURIComponent(code)}.json`)
    if (!res.ok) return { found: false, reason: 'not_found' }
    const json: any = await res.json()
    // OFF : status === 1 = produit trouvé. Sinon (0) ou produit absent → introuvable.
    if (json?.status !== 1 || !json?.product) return { found: false, reason: 'not_found' }
    const p = json.product
    const name: string = String(p.product_name_fr || p.product_name || '').trim()
    if (!name) return { found: false, reason: 'not_found' } // produit sans nom exploitable

    const data: Partial<ProductFields> = { name }
    const brand = typeof p.brands === 'string' ? p.brands.split(',')[0].trim() : ''
    if (brand) data.brand = brand
    const tag = Array.isArray(p.categories_tags) ? p.categories_tags[0] : undefined
    if (typeof tag === 'string') {
      const c = cleanCategoryTag(tag)
      if (c) data.category = c
    }
    if (typeof p.image_front_url === 'string' && p.image_front_url) data.image = p.image_front_url
    if (typeof p.quantity === 'string' && p.quantity.trim()) data.unit = p.quantity.trim()

    return { found: true, data }
  } catch {
    // Erreur réseau / JSON : pas de throw, l'appelant gère le fallback saisie manuelle.
    return { found: false, reason: 'network' }
  }
}
