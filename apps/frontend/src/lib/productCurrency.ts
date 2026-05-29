// Helpers de conversion devise aux frontières I/O du form Stock.
//
// CONVENTION HABASHOP : tous les prix produits sont stockés en XOF en base.
// Le tenant affiche dans sa devise (EUR/USD/…) → conversion à l'affichage via
// useFormatAmount(). Le form Stock fonctionne dans la devise d'affichage du
// tenant (ce que l'utilisateur tape et lit dans les inputs), donc on convertit :
//   - à la lecture (API → form state) : XOF → display
//   - à l'écriture (form state → API)  : display → XOF
//
// Le POS, le dashboard, les exports, les rapports : inchangés (XOF côté DB).

import { convertAmount } from '@/stores/appStore'

export type PriceTier = { minQty: number; price: number; label?: string }

// Forme attendue par le form state (camelCase Stock convention).
// On ne fixe pas une interface stricte pour éviter un couplage trop fort —
// le form state ajoute d'autres champs (name, category, sku, …) qu'on passe inchangés.
type ApiProduct = {
  buyPrice?: number
  sellPrice?: number
  wholesalePrice?: number | null
  semiWholesalePrice?: number | null
  promotionPrice?: number | null
  priceTiers?: PriceTier[] | null | unknown
  [k: string]: unknown
}

type FormState = {
  buy?: number
  sell?: number
  priceWholesale?: number
  priceSemiWholesale?: number
  promotionPrice?: number
  priceTiers?: PriceTier[]
  [k: string]: unknown
}

// Convertit XOF (DB) → display currency (form state). À utiliser après productsApi.get/list.
export function hydratePricesFromApi<T extends ApiProduct>(
  apiProduct: T,
  displayCurrency: string,
): { buy: number; sell: number; priceWholesale: number; priceSemiWholesale: number; promotionPrice: number; priceTiers: PriceTier[] } {
  const fromXOF = (amount: number | null | undefined): number =>
    convertAmount(Number(amount) || 0, 'XOF', displayCurrency)

  const rawTiers = apiProduct.priceTiers
  const tiers: PriceTier[] = Array.isArray(rawTiers)
    ? (rawTiers as PriceTier[]).map(t => ({
        minQty: Number(t.minQty) || 0,
        price: fromXOF(t.price),
        ...(t.label ? { label: t.label } : {}),
      }))
    : []

  return {
    buy:                fromXOF(apiProduct.buyPrice),
    sell:               fromXOF(apiProduct.sellPrice),
    priceWholesale:     fromXOF(apiProduct.wholesalePrice),
    priceSemiWholesale: fromXOF(apiProduct.semiWholesalePrice),
    promotionPrice:     fromXOF(apiProduct.promotionPrice),
    priceTiers:         tiers,
  }
}

// Convertit display currency (form state) → XOF (DB). À utiliser avant productsApi.create/update.
export function dehydratePricesForApi<T extends FormState>(
  formState: T,
  displayCurrency: string,
): { buyPrice: number; sellPrice: number; wholesalePrice: number | null; semiWholesalePrice: number | null; promotionPrice: number | null; priceTiers: PriceTier[] | null } {
  const toXOF = (amount: number | null | undefined): number =>
    convertAmount(Number(amount) || 0, displayCurrency, 'XOF')

  const tiers: PriceTier[] | null = (formState.priceTiers && formState.priceTiers.length)
    ? formState.priceTiers.map(t => ({
        minQty: Number(t.minQty) || 0,
        price: toXOF(t.price),
        ...(t.label ? { label: t.label } : {}),
      }))
    : null

  return {
    buyPrice:           toXOF(formState.buy),
    sellPrice:          toXOF(formState.sell),
    wholesalePrice:     formState.priceWholesale     ? toXOF(formState.priceWholesale)     : null,
    semiWholesalePrice: formState.priceSemiWholesale ? toXOF(formState.priceSemiWholesale) : null,
    promotionPrice:     formState.promotionPrice     ? toXOF(formState.promotionPrice)     : null,
    priceTiers:         tiers,
  }
}
