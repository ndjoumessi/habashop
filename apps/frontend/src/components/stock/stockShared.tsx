import { t } from '@/stores/appStore'

export type ProductItem = {
  _id?: string; sku: string; name: string; category: string
  buy: number; sell: number; stock: number; threshold: number; supplier: string
  barcode?: string
}

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
