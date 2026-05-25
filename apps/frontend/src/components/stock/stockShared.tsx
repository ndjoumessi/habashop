import { t } from '@/stores/appStore'

export type ProductItem = {
  _id?: string; sku: string; name: string; category: string
  buy: number; sell: number; stock: number; threshold: number; supplier: string
}

export const PRODUCTS_INIT: ProductItem[] = [
  { sku: 'PRD-001', name: '🌾 Riz parfumé 5kg',       category: 'Céréales',   buy: 3200, sell: 4500, stock: 12,  threshold: 20, supplier: 'SENRIZ'         },
  { sku: 'PRD-002', name: '🫙 Huile palme 1L',          category: 'Corps gras', buy: 1200, sell: 1800, stock: 18,  threshold: 25, supplier: 'SONACO'         },
  { sku: 'PRD-003', name: '🍚 Sucre 1kg',               category: 'Épicerie',   buy: 600,  sell: 850,  stock: 245, threshold: 50, supplier: 'CSS'            },
  { sku: 'PRD-004', name: '🌾 Farine blé 1kg',          category: 'Céréales',   buy: 400,  sell: 650,  stock: 89,  threshold: 30, supplier: 'GRANDS MOULINS' },
  { sku: 'PRD-005', name: '🧼 Savon OMO 500g',          category: 'Hygiène',    buy: 320,  sell: 500,  stock: 5,   threshold: 10, supplier: 'UNILEVER'       },
  { sku: 'PRD-006', name: '🥛 Lait poudre 400g',        category: 'Laitiers',   buy: 1500, sell: 2200, stock: 67,  threshold: 20, supplier: 'NESTLÉ'         },
  { sku: 'PRD-007', name: '🫒 Huile végétale 5L',       category: 'Corps gras', buy: 6500, sell: 8500, stock: 34,  threshold: 15, supplier: 'SONACO'         },
  { sku: 'PRD-008', name: '🍅 Tomate concentrée 800g',  category: 'Conserves',  buy: 900,  sell: 1400, stock: 112, threshold: 30, supplier: 'TOMAPOR'        },
]

export const CATEGORIES_INIT = [
  { id:1, name:'Céréales',   color:'#818CF8', icon:'🌾', productsCount:3, description:'Riz, farine, semoule...'     },
  { id:2, name:'Corps gras', color:'#F59E0B', icon:'🫙', productsCount:2, description:'Huiles, beurre de karité...' },
  { id:3, name:'Épicerie',   color:'#34D399', icon:'🍚', productsCount:2, description:'Sucre, café, condiments...'  },
  { id:4, name:'Hygiène',    color:'#F472B6', icon:'🧼', productsCount:2, description:'Savons, détergents...'       },
  { id:5, name:'Laitiers',   color:'#60A5FA', icon:'🥛', productsCount:2, description:'Lait, fromage, yaourt...'   },
  { id:6, name:'Conserves',  color:'#A78BFA', icon:'🍅', productsCount:2, description:'Tomates, sardines, thon...' },
]

export function statusOf(stock: number, threshold: number) {
  if (stock === 0)        return { label: t('status_out'), cls: 'badge-red'   }
  if (stock <= threshold) return { label: t('status_low'), cls: 'badge-amber' }
  return                         { label: 'OK',             cls: 'badge-green' }
}
