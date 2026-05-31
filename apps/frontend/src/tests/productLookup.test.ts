import { describe, it, expect, vi, afterEach } from 'vitest'
import { lookupProductByEan, cleanCategoryTag } from '@/lib/productLookup'

const okResponse = (body: any) => ({ ok: true, json: async () => body }) as any

afterEach(() => { vi.unstubAllGlobals() })

describe('cleanCategoryTag', () => {
  it('retire le préfixe langue et remplace les tirets', () => {
    expect(cleanCategoryTag('en:breakfast-cereals')).toBe('breakfast cereals')
    expect(cleanCategoryTag('fr:produits-laitiers')).toBe('produits laitiers')
    expect(cleanCategoryTag('snacks')).toBe('snacks')
  })
})

describe('lookupProductByEan', () => {
  it('produit trouvé → mappe les champs + nettoie la catégorie + préfère product_name_fr', () => {
    return (async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({
        status: 1,
        product: {
          product_name: 'Hazelnut spread',
          product_name_fr: 'Pâte à tartiner',
          brands: 'Nutella, Ferrero',
          categories_tags: ['en:breakfast-cereals', 'en:spreads'],
          image_front_url: 'https://img.off/nutella.jpg',
          quantity: '400 g',
        },
      })))
      const r = await lookupProductByEan('3017620422003')
      expect(r.found).toBe(true)
      if (!r.found) return
      expect(r.data.name).toBe('Pâte à tartiner')           // product_name_fr prioritaire
      expect(r.data.brand).toBe('Nutella')                  // 1re marque seulement
      expect(r.data.category).toBe('breakfast cereals')     // tag[0] nettoyé (préfixe en:)
      expect(r.data.image).toBe('https://img.off/nutella.jpg')
      expect(r.data.unit).toBe('400 g')
    })()
  })

  it('repli sur product_name si product_name_fr absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({
      status: 1, product: { product_name: 'Olive oil 1L' },
    })))
    const r = await lookupProductByEan('123')
    expect(r.found).toBe(true)
    if (r.found) expect(r.data.name).toBe('Olive oil 1L')
  })

  it('status !== 1 → { found: false, not_found }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ status: 0, product: null })))
    const r = await lookupProductByEan('0000000000000')
    expect(r).toEqual({ found: false, reason: 'not_found' })
  })

  it('produit trouvé mais SANS nom → { found: false, not_found }', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({
      status: 1, product: { brands: 'X', quantity: '1 L' }, // pas de product_name
    })))
    const r = await lookupProductByEan('123')
    expect(r).toEqual({ found: false, reason: 'not_found' })
  })

  it('réponse HTTP non-ok → { found: false, not_found } (pas de throw)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) } as any))
    const r = await lookupProductByEan('123')
    expect(r).toEqual({ found: false, reason: 'not_found' })
  })

  it('erreur réseau → { found: false, network } sans throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const r = await lookupProductByEan('123')
    expect(r).toEqual({ found: false, reason: 'network' })
  })

  it('EAN vide → { found: false, not_found } sans appel réseau', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const r = await lookupProductByEan('   ')
    expect(r).toEqual({ found: false, reason: 'not_found' })
    expect(f).not.toHaveBeenCalled()
  })
})
