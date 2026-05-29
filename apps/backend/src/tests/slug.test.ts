import { describe, it, expect, vi } from 'vitest'
import { slugify, isValidSlug, generateUniqueSlug, RESERVED_SLUGS } from '../utils/slug'

describe('slugify', () => {
  it('normalise un nom simple', () => {
    expect(slugify('Supérette Yoff')).toBe('superette-yoff')
  })

  it('retire les accents (NFD)', () => {
    expect(slugify('Boutique Émilie & Côté')).toBe('boutique-emilie-cote')
  })

  it('squash les caractères spéciaux en un seul -', () => {
    expect(slugify('Hello---World!!!')).toBe('hello-world')
  })

  it('trim les tirets de début/fin', () => {
    expect(slugify('---abc---')).toBe('abc')
  })

  it('coupe à 50 caractères', () => {
    const long = 'a'.repeat(80)
    expect(slugify(long).length).toBeLessThanOrEqual(50)
  })

  it('chaîne vide → vide', () => {
    expect(slugify('')).toBe('')
    expect(slugify('   ')).toBe('')
  })

  it('chiffres conservés', () => {
    expect(slugify('Shop 2025')).toBe('shop-2025')
  })
})

describe('isValidSlug', () => {
  it('valide les bons slugs', () => {
    expect(isValidSlug('supershop')).toBe(true)
    expect(isValidSlug('shop-2025')).toBe(true)
    expect(isValidSlug('abc')).toBe(true) // min 3
    expect(isValidSlug('a' + '0'.repeat(48) + 'z')).toBe(true) // 50 chars
  })

  it('rejette trop court / trop long', () => {
    expect(isValidSlug('ab')).toBe(false)
    expect(isValidSlug('a'.repeat(51))).toBe(false)
  })

  it('rejette chars non autorisés', () => {
    expect(isValidSlug('Hello')).toBe(false) // majuscules
    expect(isValidSlug('shop_2025')).toBe(false) // underscore
    expect(isValidSlug('shop.com')).toBe(false) // point
    expect(isValidSlug('-shop')).toBe(false) // commence par -
    expect(isValidSlug('shop-')).toBe(false) // finit par -
  })

  it('rejette les réservés', () => {
    expect(isValidSlug('login')).toBe(false)
    expect(isValidSlug('app')).toBe(false)
    expect(isValidSlug('admin')).toBe(false)
    expect(isValidSlug('c')).toBe(false)
  })
})

describe('generateUniqueSlug', () => {
  function fakePrisma(existingSlugs: string[] = []) {
    return {
      tenant: {
        findFirst: vi.fn(async ({ where }: any) => {
          return existingSlugs.includes(where.slug) ? { id: 'someone-else' } : null
        }),
      },
    }
  }

  it('aucune collision → slug direct', async () => {
    const p = fakePrisma([])
    expect(await generateUniqueSlug(p, 'Supérette Yoff', 't1')).toBe('superette-yoff')
  })

  it('1 collision → suffixe -2', async () => {
    const p = fakePrisma(['superette-yoff'])
    expect(await generateUniqueSlug(p, 'Supérette Yoff', 't1')).toBe('superette-yoff-2')
  })

  it('2 collisions → -3', async () => {
    const p = fakePrisma(['superette-yoff', 'superette-yoff-2'])
    expect(await generateUniqueSlug(p, 'Supérette Yoff', 't1')).toBe('superette-yoff-3')
  })

  it('5 collisions → -6', async () => {
    const p = fakePrisma(['myshop', 'myshop-2', 'myshop-3', 'myshop-4', 'myshop-5'])
    expect(await generateUniqueSlug(p, 'MyShop', 't1')).toBe('myshop-6')
  })

  it('nom vide → fallback shop-{tenantId.slice(0,6)}', async () => {
    const p = fakePrisma([])
    expect(await generateUniqueSlug(p, '', 'cuid12345abc')).toBe('shop-cuid12')
  })

  it('nom réservé → fallback shop-{tenantId.slice(0,6)}', async () => {
    const p = fakePrisma([])
    expect(await generateUniqueSlug(p, 'admin', 'abc123def456')).toBe('shop-abc123')
  })

  it('nom trop court (1 char) → fallback (min 3)', async () => {
    const p = fakePrisma([])
    expect(await generateUniqueSlug(p, 'A', 'cuid12345abc')).toBe('shop-cuid12')
  })

  it('100+ collisions → fallback timestamp', async () => {
    const list = ['myshop', ...Array.from({ length: 100 }, (_, i) => `myshop-${i + 2}`)]
    const p = fakePrisma(list)
    const slug = await generateUniqueSlug(p, 'MyShop', 't1')
    expect(slug.startsWith('myshop-')).toBe(true)
    expect(slug.length).toBeGreaterThan(7)
  })

  it('le slug du tenant lui-même est exclu (NOT id)', async () => {
    const findFirst = vi.fn(async ({ where }: any) => {
      // Si on cherche un autre tenant avec ce slug, on accepte (pas trouvé)
      // (le mock vérifie juste qu'on passe bien le NOT)
      expect(where.NOT).toEqual({ id: 't-self' })
      return null
    })
    const p = { tenant: { findFirst } }
    await generateUniqueSlug(p, 'My Shop', 't-self')
    expect(findFirst).toHaveBeenCalled()
  })

  it('garde RESERVED_SLUGS exporté correct', () => {
    expect(RESERVED_SLUGS.has('login')).toBe(true)
    expect(RESERVED_SLUGS.has('app')).toBe(true)
    expect(RESERVED_SLUGS.has('c')).toBe(true)
    expect(RESERVED_SLUGS.has('mycustomname')).toBe(false)
  })
})
