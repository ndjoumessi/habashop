import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { categoriesAvecEffectif } from '@/components/stock/stockShared'

/**
 * LES CATÉGORIES DE L'ÉCRAN STOCK SONT CELLES DU CATALOGUE.
 *
 * ⚠️ MESURÉ À L'ÉCRAN le 2026-10-01 : le panneau « Gestion des catégories » affichait
 * Céréales (3 produits), Corps gras (2), Épicerie (2), Hygiène (2), Laitiers (2),
 * Conserves (2) — sur une boutique qui n'avait AUCUNE de ces deux dernières et qui en
 * portait neuf autres. Ces effectifs étaient des LITTÉRAUX (`CATEGORIES_INIT`), et le
 * `setCategories` n'était appelé que par une édition locale : rien ne chargeait jamais les
 * vraies catégories.
 *
 * ⚠️ Il n'existe ni modèle `Category` ni route `/api/categories` : `Product.category` est un
 * champ texte libre. Un compteur qui ne peut pas être faux parce qu'il ne mesure rien —
 * la famille « LE CHAMP DÉCLARÉ QUI SE FAIT PASSER POUR UNE MESURE ».
 */

const produit = (category: string | null | undefined) => ({ category } as { category?: string | null })

describe('categoriesAvecEffectif', () => {
  it('rend les catégories RÉELLEMENT portées, avec leur effectif RÉEL', () => {
    expect(categoriesAvecEffectif([
      produit('Boissons'), produit('Boissons'), produit('Boissons'),
      produit('Snacks'), produit('Snacks'),
      produit('Papeterie'),
    ])).toEqual([
      { name: 'Boissons', productsCount: 3 },
      { name: 'Snacks', productsCount: 2 },
      { name: 'Papeterie', productsCount: 1 },
    ])
  })

  it('à effectif ÉGAL, l’ordre est alphabétique — jamais celui de l’insertion', () => {
    const noms = categoriesAvecEffectif([produit('Snacks'), produit('Boissons'), produit('Épicerie')])
      .map(c => c.name)
    expect(noms, 'un ordre dépendant de l’insertion fait danser les tuiles à chaque rechargement').toEqual(
      ['Boissons', 'Épicerie', 'Snacks'],
    )
  })

  it('⚠️ un produit SANS catégorie n’en crée pas une, et n’est compté nulle part', () => {
    const r = categoriesAvecEffectif([produit('Boissons'), produit(null), produit(''), produit('   '), produit(undefined)])
    expect(r).toEqual([{ name: 'Boissons', productsCount: 1 }])
  })

  it('un catalogue vide rend une liste vide — pas un catalogue par défaut', () => {
    expect(categoriesAvecEffectif([])).toEqual([])
  })
})

/**
 * ⚠️ MÉTA-TEST — la SIGNATURE exacte du défaut : un effectif écrit en LITTÉRAL.
 *
 * Un effectif se compte ; il ne s'écrit pas. Ce scan interdit la réapparition de
 * `productsCount: <nombre>` dans tout le front. Périmètre DÉRIVÉ de l'arborescence, avec
 * une assertion de couverture — un `walk()` cassé rendrait une liste vide, donc un vert qui
 * ne garde rien — et un témoin positif qui prouve que le motif détecte bien sa forme.
 */
describe('méta — aucun effectif de catégorie en littéral', () => {
  const RACINE = resolve(__dirname, '..')
  const MOTIF = /productsCount\s*:\s*\d/

  function fichiers(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) { if (e !== 'node_modules') fichiers(p, acc) }
      else if (/\.tsx?$/.test(e) && !p.includes('/tests/')) acc.push(p)
    }
    return acc
  }

  it('le motif détecte bien sa forme — témoin positif', () => {
    expect(MOTIF.test("{ id:1, name:'Céréales', productsCount:3 }")).toBe(true)
    expect(MOTIF.test('productsCount: compter(produits)')).toBe(false)
  })

  it('⚠️ aucun fichier de `src/` ne déclare un effectif en dur', () => {
    const liste = fichiers(RACINE)
    expect(liste.length, 'balayage vide → le verrou ne garde rien').toBeGreaterThan(100)
    const fautifs = liste.filter(p => MOTIF.test(readFileSync(p, 'utf-8')))
    expect(fautifs.map(p => p.slice(RACINE.length + 1))).toEqual([])
  })
})
