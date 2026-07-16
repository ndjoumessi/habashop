import type { APIRequestContext } from '@playwright/test'

// Fixtures E2E DATÉES, créées via l'API authentifiée (compte e2e@) — AUCUNE credential DB.
// Le repo est PUBLIC : on n'expose pas DATABASE_URL. La fraîcheur (ventes du jour → donut)
// est donc assurée ici, dans le setup Playwright, et non par un seed CI.
//
// Écritures strictement scopées au tenant actif du token e2e@ (= e2e-tenant).

const API_ROOT = process.env.API_URL ?? 'https://habashop-production.up.railway.app'

/**
 * Garantit qu'`e2e-tenant` a des ventes du JOUR sur ≥2 catégories → `categoryBreakdown`
 * non vide pour `dashboard-donut`, quel que soit le jour du run.
 *
 * - `createdAt` = now() (défaut serveur) → fraîcheur automatique, sans dater côté client.
 * - Idempotent : `idempotencyKey` stable par jour (`e2e-sale-YYYYMMDD-<i>`) → un re-run le
 *   même jour renvoie la vente existante (pas de doublon). Accumulation ≈ 3 ventes/jour sur
 *   ce tenant de test (bornée par jour ; acceptable, purgeable via seed-e2e-tenant.ts).
 * - Anti-dépletion : le stock des produits ciblés est remis à une valeur haute (absolue)
 *   avant chaque création → les ventes répétées n'épuisent jamais le stock.
 */
export async function ensureRecentSales(request: APIRequestContext, token: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` }

  const products: any[] = await request
    .get(`${API_ROOT}/api/products`, { headers })
    .then(r => r.json())
  if (!Array.isArray(products) || products.length === 0) {
    console.warn('[fixtures] aucun produit sur e2e-tenant — ventes du jour non créées.')
    return
  }

  // Un produit par catégorie distincte → ≥2 secteurs pour le donut.
  const byCategory = new Map<string, any>()
  for (const p of products) if (!byCategory.has(p.category)) byCategory.set(p.category, p)
  const picks = [...byCategory.values()].slice(0, 3)

  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD (jour du run)
  const payModes = ['cash', 'wave', 'card']

  for (let i = 0; i < picks.length; i++) {
    const p = picks[i]
    // Réappro (valeur absolue → idempotent, évite la dépletion dans le temps).
    await request.put(`${API_ROOT}/api/products/${p.id}`, { headers, data: { stockQty: 999 } })
    const qty = 2 + i
    await request.post(`${API_ROOT}/api/sales`, {
      headers,
      data: {
        items: [{ productId: p.id, qty, price: p.sellPrice, tierLabel: null }],
        paymentMode: payModes[i % payModes.length],
        total: p.sellPrice * qty,
        customerId: null,
        idempotencyKey: `e2e-sale-${ymd}-${i}`,
      },
    })
  }
  console.log(`[fixtures] ventes du jour garanties sur e2e-tenant (${picks.length} catégories).`)
}
