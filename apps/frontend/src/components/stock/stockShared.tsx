import { t } from '@/stores/appStore'
import { isPromotionActive } from '@/lib/pricing'

/**
 * FRONTIÈRE — ce que `GET /api/products` renvoie RÉELLEMENT (#185).
 *
 * ⚠️ Dérivé du `model Product` de `schema.prisma`, pas de ce qu'on croit recevoir : la route
 * fait `prisma.product.findMany({ where: { tenantId, deletedAt: null } })` — **aucun `select`**,
 * donc le modèle ENTIER traverse. La leçon de la semaine (`isActive` lu comme `active`,
 * `totalRevenue` lu comme `totalCA`) : un type écrit d'après une supposition COMPILE ET MENT.
 *
 * ⚠️ Distinct de `ProductItem`, qui est le type de DOMAINE : le mapper renomme
 * (`buyPrice`→`buy`, `sellPrice`→`sell`, `stockQty`→`stock`, `stockMin`→`threshold`).
 * Les confondre est exactement ce qui a produit les deux bugs de frontière de #215.
 *
 * ⚠️ Les `DateTime` Prisma arrivent en **chaîne ISO** après sérialisation JSON, jamais en `Date`.
 */
export type ApiProduct = {
  id: string
  tenantId: string
  sku: string
  name: string
  description: string | null
  category: string
  unit: string
  buyPrice: number
  sellPrice: number
  wholesalePrice: number | null
  semiWholesalePrice: number | null
  stockQty: number
  stockMin: number
  supplierId: string | null
  barcode: string | null
  taxRate: number
  isActive: boolean
  hasPromotion: boolean
  promotionPrice: number | null
  promotionEnd: string | null
  emoji: string
  notes: string | null
  /** `Json?` côté Prisma — non contraint en base, donc validé à la lecture, pas supposé. */
  priceTiers: { minQty: number; price: number; label?: string }[] | null
  /** Écrits SERVEUR uniquement (hors liste blanche PUT) — lisibles, jamais renvoyés en écriture. */
  previousPricing: unknown | null
  pricingChangedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/**
 * Corps accepté en écriture — miroir des zod `PRODUCT_CREATE` / `PRODUCT_UPDATE`
 * (`apps/backend/src/routes/products.ts`). ⚠️ `PRODUCT_UPDATE` est une liste blanche STRICTE
 * (strip) : un champ hors de cette liste est SILENCIEUSEMENT supprimé côté serveur — le typer
 * ici évite de croire qu'on écrit un champ que le serveur jette (c'est le garde anti
 * mass-assignment, on ne l'affaiblit pas, on le rend visible).
 */
export type ProductWrite = Partial<Pick<ApiProduct,
  | 'name' | 'description' | 'category' | 'unit' | 'buyPrice' | 'sellPrice'
  | 'wholesalePrice' | 'semiWholesalePrice' | 'stockQty' | 'stockMin'
  | 'supplierId' | 'barcode' | 'taxRate' | 'isActive'
  | 'hasPromotion' | 'promotionPrice' | 'promotionEnd' | 'emoji' | 'notes' | 'priceTiers'
>> & { sku?: string }

export type ProductItem = {
  _id?: string; sku: string; name: string; category: string
  buy: number; sell: number; stock: number; threshold: number
  supplier: string; supplierId?: string
  barcode?: string
  description?: string; notes?: string
  priceWholesale?: number
  priceSemiWholesale?: number
  priceTiers?: { minQty: number; price: number; label?: string }[]
  // Promotion : nécessaire pour surfacer un badge PROMO dans la liste + filtrer les promos.
  // promotionEnd au format 'YYYY-MM-DD' (ou '' = pas d'échéance = promo sans fin).
  hasPromotion?: boolean
  promotionPrice?: number
  promotionEnd?: string
  /**
   * URL de la photo (stockage objet), ou `null`.
   * ⚠️ NOMMÉE `photo` ET NON `image` — DÉLIBÉRÉMENT. `StockForm.image` est
   * l'ÉMOJI du produit (envoyé en `emoji`, préfixé au nom) : deux champs
   * homonymes de sens opposés dans les mêmes fichiers sont exactement ce qui
   * produit un envoi d'émoji comme URL. Le type de frontière `ApiProduct` garde,
   * lui, le nom serveur `image` — c'est le mapper qui traverse.
   */
  photo?: string | null
}

// État du formulaire produit (Stock.tsx `useState` + prop `form`/`setForm` de StockModals).
// Typé pour le strict TS : les callbacks `setForm(f => …)` en héritent (plus d'implicit any).
export type StockForm = {
  sku: string; name: string; description: string; category: string; unit: string
  buy: number; sell: number; priceWholesale: number; priceSemiWholesale: number
  stock: number; threshold: number; supplier: string; supplierId: string
  barcode: string; taxRate: number; isActive: boolean
  hasPromotion: boolean; promotionPrice: number; promotionEnd: string
  image: string; notes: string
  priceTiers: { minQty: number; price: number; label?: string }[]
}

// Formulaire de catégorie (modale Stock) + config d'étiquettes (impression) + catégorie.
export type CatForm = { name: string; color: string; icon: string; description: string }
export type LabelConfig = {
  size: 'small' | 'medium' | 'large'
  showPrice: boolean; showSku: boolean; showBarcode: boolean; copies: number
  averyPreset: 'L7160' | 'L7163' | 'L7165' | 'L7651' | 'CUSTOM' | 'THERMAL_40x30'
}
export type Category = { id: number; name: string; color: string; icon: string; productsCount: number; description: string }

// Un produit a-t-il une promotion EFFECTIVE (activée + non expirée) ? Source unique pour
// le badge PROMO de la liste ET le filtre « En promotion » → les deux ne peuvent pas
// diverger. `now` injecté (défaut new Date()). Réutilise isPromotionActive (miroir back/front).
export const isActivePromo = (p: ProductItem, now: Date = new Date()): boolean =>
  isPromotionActive(p.hasPromotion, p.promotionEnd, now)

export const CATEGORIES_INIT = [
  { id:1, name:'Céréales',   color:'#818CF8', icon:'🌾', productsCount:3, description:'Riz, farine, semoule...'     },
  { id:2, name:'Corps gras', color:'#F59E0B', icon:'🫙', productsCount:2, description:'Huiles, beurre de karité...' },
  { id:3, name:'Épicerie',   color:'#34D399', icon:'🍚', productsCount:2, description:'Sucre, café, condiments...'  },
  { id:4, name:'Hygiène',    color:'#F472B6', icon:'🧼', productsCount:2, description:'Savons, détergents...'       },
  { id:5, name:'Laitiers',   color:'#60A5FA', icon:'🥛', productsCount:2, description:'Lait, fromage, yaourt...'   },
  { id:6, name:'Conserves',  color:'#A78BFA', icon:'🍅', productsCount:2, description:'Tomates, sardines, thon...' },
]

// ─── Libellés catégories statiques i18n ─────
// Traduit UNIQUEMENT les catégories prédéfinies de l'interface.
// Les catégories/produits saisis par le commerçant passent inchangés (fallback).
export const STOCK_CATS_T: Record<string, Record<string, string>> = {
  'Céréales':   { fr:'Céréales',   en:'Cereals',      es:'Cereales',    it:'Cereali'    },
  'Corps gras': { fr:'Corps gras', en:'Oils & Fats',  es:'Aceites',     it:'Grassi'     },
  'Épicerie':   { fr:'Épicerie',   en:'Grocery',      es:'Comestibles', it:'Drogheria'  },
  'Hygiène':    { fr:'Hygiène',    en:'Hygiene',      es:'Higiene',     it:'Igiene'     },
  'Laitiers':   { fr:'Laitiers',   en:'Dairy',        es:'Lácteos',     it:'Latticini'  },
  'Conserves':  { fr:'Conserves',  en:'Canned goods', es:'Conservas',   it:'Conserve'   },
  'Boissons':   { fr:'Boissons',   en:'Drinks',       es:'Bebidas',     it:'Bevande'    },
  'Condiments': { fr:'Condiments', en:'Condiments',   es:'Condimentos', it:'Condimenti' },
}
export const stockCatLabel = (name: string, lang: string) =>
  STOCK_CATS_T[name]?.[lang] ?? name

// Descriptions des catégories prédéfinies (fallback pour les catégories custom)
export const STOCK_CAT_DESC_T: Record<string, Record<string, string>> = {
  'Riz, farine, semoule...':     { fr:'Riz, farine, semoule...',     en:'Rice, flour, semolina...',  es:'Arroz, harina, sémola...',  it:'Riso, farina, semolino...'  },
  'Huiles, beurre de karité...': { fr:'Huiles, beurre de karité...', en:'Oils, shea butter...',      es:'Aceites, manteca karité...',it:'Oli, burro di karité...'    },
  'Sucre, café, condiments...':  { fr:'Sucre, café, condiments...',  en:'Sugar, coffee, condiments...',es:'Azúcar, café, condimentos...',it:'Zucchero, caffè, condimenti...' },
  'Savons, détergents...':       { fr:'Savons, détergents...',       en:'Soaps, detergents...',      es:'Jabones, detergentes...',   it:'Saponi, detergenti...'      },
  'Lait, fromage, yaourt...':    { fr:'Lait, fromage, yaourt...',    en:'Milk, cheese, yogurt...',   es:'Leche, queso, yogur...',    it:'Latte, formaggio, yogurt...'},
  'Tomates, sardines, thon...':  { fr:'Tomates, sardines, thon...',  en:'Tomatoes, sardines, tuna...',es:'Tomates, sardinas, atún...',it:'Pomodori, sardine, tonno...'},
}
export const stockCatDesc = (desc: string, lang: string) =>
  STOCK_CAT_DESC_T[desc]?.[lang] ?? desc

export function statusOf(stock: number, threshold: number) {
  if (stock === 0)        return { label: t('status_out'), cls: 'badge-red'   }
  if (stock <= threshold) return { label: t('status_low'), cls: 'badge-amber' }
  return                         { label: 'OK',             cls: 'badge-green' }
}

/**
 * Marge commerciale d'un produit. `pct` = (vente − achat) / vente × 100, arrondi entier —
 * grandeur SANS unité, donc aucune conversion devise (contrairement à un montant). `profitXof`
 * = vente − achat en XOF brut, converti UNE seule fois à l'affichage par `fmt`. `pct = null`
 * si la vente est nulle (ni marge ni division par zéro). `profitXof` peut être négatif (vente à perte).
 */
export function productMargin(buyXof: number, sellXof: number): { pct: number | null; profitXof: number } {
  const profitXof = sellXof - buyXof
  const pct = sellXof > 0 ? Math.round((profitXof / sellXof) * 100) : null
  return { pct, profitXof }
}
