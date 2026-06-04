import { describe, it, expect, vi } from 'vitest'
import { computeReorder, computeDormant, buildInventoryInsights, type ProductLite } from '../routes/reports'

const P = (id: string, stockQty: number, stockMin: number, buyPrice: number, name = id): ProductLite =>
  ({ id, name, category: 'Épicerie', stockQty, stockMin, buyPrice })

describe('computeReorder — seuil + tri vélocité + suggestion', () => {
  it('garde stock ≤ seuil, trie par vélocité 30j desc, suggestedQty = max(0, vélocité − stock)', () => {
    const products = [P('p1', 2, 5, 100), P('p2', 0, 5, 50), P('p3', 20, 5, 200), P('p4', 10, 5, 30)]
    const vel = new Map([['p1', 8], ['p2', 0]])
    const r = computeReorder(products, vel)
    expect(r.map(x => x.id)).toEqual(['p1', 'p2'])          // p3/p4 hors seuil exclus ; p1 (vél 8) avant p2 (vél 0)
    expect(r[0]).toMatchObject({ stock: 2, threshold: 5, velocity30d: 8, suggestedQty: 6 })
    expect(r[1]).toMatchObject({ stock: 0, velocity30d: 0, suggestedQty: 0 })
  })
  it('aucun produit sous le seuil → liste vide', () => {
    expect(computeReorder([P('p3', 20, 5, 200)], new Map())).toEqual([])
  })
})

describe('computeDormant — fenêtre + valeur immobilisée', () => {
  const now = new Date('2026-06-04T00:00:00Z')
  it('stock>0 & non vendu récemment → valeur = stock×coût, tri desc, daysSinceSale', () => {
    const products = [P('p1', 2, 5, 100), P('p2', 0, 5, 50), P('p3', 20, 5, 200), P('p4', 10, 5, 30)]
    const soldRecent = new Set(['p1'])                       // p1 vendu < 60j → exclu
    const lastSale = new Map<string, string | null>([['p3', '2026-03-06T00:00:00Z']]) // p3 il y a ~90j ; p4 jamais
    const d = computeDormant(products, soldRecent, lastSale, now)
    expect(d.map(x => x.id)).toEqual(['p3', 'p4'])           // p2 (stock 0) exclu ; tri valeur desc (4000 > 300)
    expect(d[0]).toMatchObject({ id: 'p3', stock: 20, immobilizedValue: 4000, daysSinceSale: 90 })
    expect(d[1]).toMatchObject({ id: 'p4', immobilizedValue: 300, lastSale: null, daysSinceSale: null })
  })
  it('stock 0 jamais dormant', () => {
    expect(computeDormant([P('p2', 0, 5, 50)], new Set(), new Map(), now)).toEqual([])
  })
})

describe('buildInventoryInsights — agrégation + scope tenant', () => {
  function mockDb(over: any = {}) {
    return {
      product: { findMany: vi.fn().mockResolvedValue(over.products ?? [P('p1', 2, 5, 100), P('p3', 20, 5, 200)]) },
      saleItem: {
        groupBy: vi.fn().mockResolvedValue(over.vel ?? [{ productId: 'p1', _sum: { qty: 8 } }]),
        findMany: vi.fn()
          .mockResolvedValueOnce(over.recent ?? [{ productId: 'p1' }])                       // vendus < 60j
          .mockResolvedValueOnce(over.last ?? [{ productId: 'p3', sale: { createdAt: new Date('2026-03-06T00:00:00Z') } }]),
      },
    }
  }

  it('scope tenant strict + réappro + dormants', async () => {
    const db = mockDb()
    const res = await buildInventoryInsights(db, 'T1', new Date('2026-06-04T00:00:00Z'))
    // isolation : toutes les requêtes scopées T1
    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'T1', isActive: true, deletedAt: null }) }))
    expect(db.saleItem.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { sale: expect.objectContaining({ tenantId: 'T1' }) } }))
    expect(res.reorder.map((r: any) => r.id)).toEqual(['p1'])     // p1 (stock 2 ≤ 5) ; p3 hors seuil
    expect(res.reorder[0].velocity30d).toBe(8)
    expect(res.dormant.map((d: any) => d.id)).toEqual(['p3'])     // p3 stock>0 & pas vendu < 60j ; p1 vendu récemment exclu
    expect(res.dormant[0].immobilizedValue).toBe(4000)
    expect(res.dormantDays).toBe(60)
  })

  it('cas limite — aucune vente : tous les produits à stock>0 deviennent dormants', async () => {
    const db = mockDb({ vel: [], recent: [], last: [] })
    const res = await buildInventoryInsights(db, 'T1', new Date('2026-06-04T00:00:00Z'))
    expect(res.dormant.map((d: any) => d.id).sort()).toEqual(['p1', 'p3'])
    expect(res.dormant.every((d: any) => d.daysSinceSale === null)).toBe(true) // jamais vendus
    // p1 reste aussi en réappro (stock 2 ≤ 5), vélocité 0 → suggestion 0
    expect(res.reorder.map((r: any) => r.id)).toEqual(['p1'])
    expect(res.reorder[0].suggestedQty).toBe(0)
  })
})
